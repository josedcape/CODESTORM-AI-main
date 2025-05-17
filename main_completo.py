import os
import json
import logging
import traceback
import subprocess
import threading
import re  # Añadir esta importación
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import eventlet
eventlet.monkey_patch()
import uuid

# Configuración de claves API (para desarrollo, en producción usar variables de entorno)
# Descomenta y configura las líneas que necesites
# os.environ['OPENAI_API_KEY'] = 'tu-clave-api-openai'
# os.environ['ANTHROPIC_API_KEY'] = 'tu-clave-api-anthropic'
# os.environ['GEMINI_API_KEY'] = 'tu-clave-api-gemini'

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Verificar claves API
openai_api_key = os.getenv('OPENAI_API_KEY')
if openai_api_key:
    logger.info(f"OpenAI API key configurada: {openai_api_key[:5]}...{openai_api_key[-5:]}")
else:
    logger.warning("No se encontró la clave de API de OpenAI en las variables de entorno")

anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
if anthropic_api_key:
    logger.info("Anthropic API key configured successfully.")
else:
    logger.warning("No se encontró la clave de API de Anthropic en las variables de entorno")

gemini_api_key = os.getenv('GEMINI_API_KEY')
if gemini_api_key:
    logger.info("Gemini API key configured successfully.")
else:
    logger.warning("No se encontró la clave de API de Google Gemini en las variables de entorno")

# Crear la aplicación Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'codestorm-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB máximo para subidas
app.config['USER_WORKSPACES'] = os.path.join(os.getcwd(), 'user_workspaces')

# Configurar SocketIO para actualización en tiempo real
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Extensiones permitidas para subida de archivos
ALLOWED_EXTENSIONS = {'py', 'js', 'html', 'css', 'json', 'txt', 'md', 'csv', 'yml', 'yaml'}

def allowed_file(filename):
    """Verifica si un archivo tiene una extensión permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_workspace(user_id):
    """Obtiene la ruta al workspace del usuario."""
    workspace_path = os.path.join(app.config['USER_WORKSPACES'], user_id)
    os.makedirs(workspace_path, exist_ok=True)
    return workspace_path

def get_file_type(filename):
    """Determina el tipo de archivo basado en su extensión."""
    if not '.' in filename:
        return "text"

    extension = filename.split('.')[-1].lower()

    if extension in ['html', 'htm']:
        return "html"
    elif extension in ['css']:
        return "css"
    elif extension in ['js']:
        return "javascript"
    elif extension in ['py']:
        return "python"
    elif extension in ['json']:
        return "json"
    elif extension in ['md']:
        return "markdown"
    elif extension in ['jpg', 'jpeg', 'png', 'gif', 'svg']:
        return "image"
    else:
        return "text"

# Funciones para importar desde agents_generators.py
def get_agent_system_prompt(agent_id):
    """Obtiene el prompt de sistema según el agente especializado seleccionado."""
    prompts = {
        'developer': """Eres un asistente especializado en desarrollo de software.
Tu enfoque principal es escribir código limpio, bien comentado y eficiente.
Cuando te pidan generar archivos, asegúrate de incluir todos los detalles necesarios para que funcionen correctamente.
Proporciona explicaciones claras sobre cómo funciona el código que generas.""",

        'architect': """Eres un asistente especializado en arquitectura de software.
Tu enfoque principal es diseñar estructuras y sistemas completos, prestando especial atención a la escalabilidad, mantenibilidad y patrones de diseño.
Cuando generes archivos, asegúrate de explicar cómo encajan en la arquitectura general.""",

        'advanced': """Eres un asistente avanzado especializado en soluciones de software sofisticadas.
Tu enfoque principal es crear sistemas complejos con las mejores prácticas, optimizaciones avanzadas y técnicas modernas.
Cuando generes archivos, incluye explicaciones detalladas de las decisiones de implementación y considera aspectos como rendimiento, seguridad y escalabilidad.""",

        'general': """Eres un asistente general para ayudar con tareas de desarrollo.
Tu objetivo es proporcionar respuestas claras y útiles, generar código cuando sea necesario, y explicar conceptos de manera accesible."""
    }

    return prompts.get(agent_id, prompts['general'])

def get_agent_name(agent_id):
    """Obtiene el nombre amigable del agente según su ID."""
    agent_names = {
        'developer': 'Desarrollador Experto',
        'architect': 'Arquitecto de Software',
        'advanced': 'Especialista Avanzado',
        'general': 'Asistente General'
    }
    return agent_names.get(agent_id, 'Asistente General')

def create_file_with_agent(description, file_ext, filename, agent_id, workspace):
    """Crea un archivo con contenido generado por un agente especializado."""
    try:
        # Obtener el prompt de sistema según el agente
        system_prompt = get_agent_system_prompt(agent_id)

        # Construir el prompt para generar el contenido del archivo
        prompt = f"""
Necesito que generes el contenido para un archivo {file_ext} llamado {filename}.
Descripción: {description}

Por favor, genera SOLO el contenido del archivo, sin explicaciones adicionales.
El contenido debe ser completo, funcional y seguir las mejores prácticas para archivos {file_ext}.
"""

        content = ""

        # Intentar generar con OpenAI primero
        if os.environ.get('OPENAI_API_KEY'):
            try:
                import openai
                client = openai.OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

                completion = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )

                content = completion.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"Error con OpenAI al generar archivo: {str(e)}")
                # Intentar con otro modelo si OpenAI falla

        # Si OpenAI falló o no está configurado, intentar con Anthropic
        if not content and os.environ.get('ANTHROPIC_API_KEY'):
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

                completion = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=2000,
                    temperature=0.7,
                    system=system_prompt,
                    messages=[{"role": "user", "content": prompt}]
                )

                content = completion.content[0].text.strip()
            except Exception as e:
                logger.error(f"Error con Anthropic al generar archivo: {str(e)}")
                # Intentar con otro modelo si Anthropic falla

        # Si los anteriores fallaron o no están configurados, intentar con Gemini
        if not content and os.environ.get('GEMINI_API_KEY'):
            try:
                import google.generativeai as genai
                genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

                full_prompt = system_prompt + "\n\n" + prompt
                model = genai.GenerativeModel('gemini-1.5-pro')
                gemini_response = model.generate_content(full_prompt)
                content = gemini_response.text.strip()
            except Exception as e:
                logger.error(f"Error con Gemini al generar archivo: {str(e)}")
                # Si todos los modelos fallan, usar contenido de respaldo

        # Si todos los modelos fallaron, usar contenido de respaldo
        if not content:
            if file_ext == 'py':
                content = f"""# {filename}
# Generado automáticamente por el agente {get_agent_name(agent_id)}
# Descripción: {description}

def main():
    print("Hola mundo desde {filename}")

if __name__ == "__main__":
    main()
"""
            elif file_ext == 'html':
                content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{filename}</title>
</head>
<body>
    <h1>Página generada por {get_agent_name(agent_id)}</h1>
    <p>{description}</p>
</body>
</html>
"""
            elif file_ext == 'js':
                content = f"""// {filename}
// Generado automáticamente por el agente {get_agent_name(agent_id)}
// Descripción: {description}

function main() {{
    console.log("Hola mundo desde {filename}");
}}

main();
"""
            else:
                content = f"""# {filename}
# Generado automáticamente por el agente {get_agent_name(agent_id)}
# Descripción: {description}

Este es un archivo de ejemplo generado según la descripción:
"{description}"
"""

        # Crear el archivo en el workspace del usuario
        file_path = os.path.join(workspace, filename)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return {
            'success': True,
            'file_path': filename,
            'content': content
        }
    except Exception as e:
        logger.error(f"Error al crear archivo con agente: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

# Rutas de la aplicación web
@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Panel de control principal."""
    return render_template('dashboard.html')

@app.route('/chat')
def chat():
    """Página de chat con agentes especializados."""
    agent_id = request.args.get('agent', 'general')
    return render_template(
        'chat.html',
        agent_id=agent_id,
        agent_name=get_agent_name(agent_id)
    )

@app.route('/files')
def files():
    """Explorador de archivos."""
    user_id = session.get('user_id', 'default')
    return render_template('files.html', user_id=user_id)

@app.route('/editor')
def editor():
    """Editor de código."""
    file_path = request.args.get('file', '')
    return render_template('editor.html', file_path=file_path)

@app.route('/code-corrector')
def code_corrector():
    """Corrector de código."""
    return render_template('code_corrector.html')

@app.route('/preview')
def preview():
    """Vista previa de archivos HTML."""
    file_path = request.args.get('file', '')
    if not file_path or not file_path.endswith(('.html', '.htm')):
        return render_template('preview.html', error="Archivo no válido para previsualización")

    user_id = session.get('user_id', 'default')
    workspace = get_user_workspace(user_id)
    full_path = os.path.join(workspace, file_path)

    try:
        with open(full_path, 'r') as f:
            content = f.read()
        return render_template('preview.html', content=content, file_path=file_path)
    except Exception as e:
        return render_template('preview.html', error=str(e))

@app.route('/augment-test')
def augment_test():
    """Página de prueba de integración estilo Augment."""
    return render_template('test_augment_like.html')

# Rutas para activos estáticos
@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    return send_from_directory('static', filename)

@app.route('/workspace/<user_id>/static/<path:filename>')
def serve_workspace_static(user_id, filename):
    workspace = get_user_workspace(user_id)
    static_dir = os.path.join(workspace, 'static')
    return send_from_directory(static_dir, filename)

# APIs para manipulación de archivos
@app.route('/api/files', methods=['GET'])
def list_files():
    """List files in a directory."""
    try:
        directory = request.args.get('directory', '.')
        # Sanitize path to prevent directory traversal
        directory = os.path.normpath(directory)

        # Get list of files and directories
        items = []
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            is_dir = os.path.isdir(item_path)
            items.append({
                "name": item,
                "path": item_path,
                "is_directory": is_dir,
                "size": os.path.getsize(item_path) if not is_dir else 0,
                "modified": datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat()
            })

        return jsonify({
            "success": True,
            "directory": directory,
            "files": items
        })
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/create', methods=['POST'])
def create_file_api():
    """API para crear o actualizar un archivo."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    file_path = request.json.get('file_path')
    content = request.json.get('content', '')

    if not file_path:
        return jsonify({
            'success': False,
            'error': 'Se requiere ruta de archivo'
        }), 400

    try:
        workspace = get_user_workspace(user_id)
        full_path = os.path.join(workspace, file_path)

        # Verificar path traversal
        if not os.path.normpath(full_path).startswith(os.path.normpath(workspace)):
            return jsonify({
                'success': False,
                'error': 'Ruta de archivo inválida'
            }), 400

        # Crear directorios si no existen
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Escribir contenido al archivo
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # Notificar a clientes conectados
        socketio.emit('file_change', {
            'type': 'update',
            'file_path': file_path
        }, room=user_id)

        return jsonify({
            'success': True,
            'file_path': file_path
        })
    except Exception as e:
        logger.error(f"Error al crear archivo: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/files/read', methods=['GET'])
def read_file_api():
    """API para leer el contenido de un archivo."""
    user_id = request.args.get('user_id', session.get('user_id', 'default'))
    file_path = request.args.get('file_path')

    if not file_path:
        return jsonify({
            'success': False,
            'error': 'Se requiere ruta de archivo'
        }), 400

    try:
        workspace = get_user_workspace(user_id)
        full_path = os.path.join(workspace, file_path)

        # Verificar path traversal
        if not os.path.normpath(full_path).startswith(os.path.normpath(workspace)):
            return jsonify({
                'success': False,
                'error': 'Ruta de archivo inválida'
            }), 400

        # Verificar que el archivo existe
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return jsonify({
                'success': False,
                'error': 'El archivo no existe'
            }), 404

        # Leer el archivo
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        return jsonify({
            'success': True,
            'file_path': file_path,
            'content': content,
            'file_type': get_file_type(file_path)
        })
    except Exception as e:
        logger.error(f"Error al leer archivo: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/files/delete', methods=['DELETE'])
def delete_file_api():
    """API para eliminar un archivo o directorio."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    file_path = request.json.get('file_path')

    if not file_path:
        return jsonify({
            'success': False,
            'error': 'Se requiere ruta de archivo'
        }), 400

    try:
        workspace = get_user_workspace(user_id)
        full_path = os.path.join(workspace, file_path)

        # Verificar path traversal
        if not os.path.normpath(full_path).startswith(os.path.normpath(workspace)):
            return jsonify({
                'success': False,
                'error': 'Ruta de archivo inválida'
            }), 400

        # Verificar que existe
        if not os.path.exists(full_path):
            return jsonify({
                'success': False,
                'error': 'El archivo o directorio no existe'
            }), 404

        # Eliminar
        if os.path.isdir(full_path):
            import shutil
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)

        # Notificar a clientes conectados
        socketio.emit('file_change', {
            'type': 'delete',
            'file_path': file_path
        }, room=user_id)

        return jsonify({
            'success': True,
            'file_path': file_path
        })
    except Exception as e:
        logger.error(f"Error al eliminar archivo: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API para ejecutar comandos
@app.route('/api/execute', methods=['POST'])
def execute_command_api():
    """API para ejecutar comandos directamente."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    command = request.json.get('command')

    if not command:
        return jsonify({
            'success': False,
            'error': 'Se requiere un comando'
        }), 400

    try:
        workspace = get_user_workspace(user_id)

        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=workspace
        )

        stdout, stderr = process.communicate(timeout=30)
        status = process.returncode

        result = {
            'success': True,
            'command': command,
            'stdout': stdout.decode('utf-8', errors='replace'),
            'stderr': stderr.decode('utf-8', errors='replace'),
            'status': status
        }

        # Notificar a clientes conectados
        socketio.emit('command_executed', result, room=user_id)

        return jsonify(result)
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': 'Tiempo de ejecución agotado (30s)'
        }), 504
    except Exception as e:
        logger.error(f"Error al ejecutar comando: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API para chat con agentes especializados
@app.route('/api/chat', methods=['POST'])
def chat_api():
    """API para chat con agentes especializados."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    message = request.json.get('message')
    agent_id = request.json.get('agent_id', 'general')
    context = request.json.get('context', [])
    model = request.json.get('model', 'openai')

    if not message:
        return jsonify({
            'success': False,
            'error': 'Se requiere un mensaje'
        }), 400

    try:
        # Obtener el prompt de sistema según el agente
        system_prompt = get_agent_system_prompt(agent_id)

        # Detectar si es una instrucción para crear un archivo
        file_creation_match = re.search(r'crea(?:r)?\s+(?:un|el|una|la)?\s+archivo\s+(?:de)?\s+([a-zA-Z0-9]+)\s+(?:llamado|con\s+nombre)?\s+([a-zA-Z0-9._-]+)', message, re.IGNORECASE)

        # Detectar si es una instrucción para ejecutar un comando
        command_match = re.search(r'^ejecuta(?:r)?[:\s]+(.+)$', message, re.IGNORECASE)

        if file_creation_match:
            file_ext = file_creation_match.group(1).lower()
            filename = file_creation_match.group(2)

            # Asegurar que el nombre del archivo tiene la extensión correcta
            if not filename.endswith('.' + file_ext):
                filename += '.' + file_ext

            # Extraer la descripción del contenido
            description = message

            # Crear el archivo usando el agente especializado
            workspace = get_user_workspace(user_id)
            result = create_file_with_agent(description, file_ext, filename, agent_id, workspace)

            if result['success']:
                response = f"He creado el archivo {filename} con el siguiente contenido:\n\n```\n{result['content'][:300]}{'...' if len(result['content']) > 300 else ''}\n```\n\n¿Necesitas que haga algún ajuste?"
            else:
                response = f"Lo siento, tuve un problema al crear el archivo: {result['error']}"

        # Detectar si es una instrucción para ejecutar un comando
        elif command_match:
            command = command_match.group(1).strip()

            # Ejecutar el comando
            workspace = get_user_workspace(user_id)

            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=workspace
            )

            stdout, stderr = process.communicate(timeout=30)
            status = process.returncode

            # Formatear respuesta
            response = f"Ejecuté el comando: `{command}`\n\n"

            if stdout:
                response += f"**Salida:**\n```\n{stdout.decode('utf-8', errors='replace')}\n```\n\n"

            if stderr:
                response += f"**Errores:**\n```\n{stderr.decode('utf-8', errors='replace')}\n```\n\n"

            response += f"Comando finalizado con código de estado: {status}"

        # Para otros mensajes, usar un modelo de IA real
        else:
            # Preparar el contexto para el modelo
            formatted_context = []
            for msg in context:
                formatted_context.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

            # Añadir el mensaje actual
            formatted_context.append({
                "role": "user",
                "content": message
            })

            # Generar respuesta con el modelo seleccionado
            if model == 'anthropic' and os.environ.get('ANTHROPIC_API_KEY'):
                # Usar Anthropic Claude
                try:
                    import anthropic
                    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

                    messages = [{"role": "system", "content": system_prompt}]
                    messages.extend(formatted_context)

                    completion = client.messages.create(
                        model="claude-3-5-sonnet-20241022",
                        messages=messages,
                        max_tokens=2000,
                        temperature=0.7
                    )
                    response = completion.content[0].text
                except Exception as e:
                    logger.error(f"Error con Anthropic API: {str(e)}")
                    response = f"Lo siento, tuve un problema al procesar tu mensaje con Anthropic: {str(e)}"

            elif model == 'gemini' and os.environ.get('GEMINI_API_KEY'):
                # Usar Google Gemini
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

                    # Construir el prompt con contexto
                    full_prompt = system_prompt + "\n\n"

                    for msg in formatted_context:
                        prefix = "Usuario: " if msg['role'] == 'user' else "Asistente: "
                        full_prompt += prefix + msg['content'] + "\n\n"

                    model = genai.GenerativeModel('gemini-1.5-pro')
                    gemini_response = model.generate_content(full_prompt)
                    response = gemini_response.text
                except Exception as e:
                    logger.error(f"Error con Gemini API: {str(e)}")
                    response = f"Lo siento, tuve un problema al procesar tu mensaje con Gemini: {str(e)}"

            else:
                # OpenAI por defecto
                try:
                    import openai
                    client = openai.OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

                    messages = [{"role": "system", "content": system_prompt}]
                    messages.extend(formatted_context)

                    completion = client.chat.completions.create(
                        model="gpt-4o",
                        messages=messages,
                        temperature=0.7,
                        max_tokens=2000
                    )
                    response = completion.choices[0].message.content
                except Exception as e:
                    logger.error(f"Error con OpenAI API: {str(e)}")
                    response = f"Lo siento, tuve un problema al procesar tu mensaje con OpenAI: {str(e)}"

        return jsonify({
            'success': True,
            'message': message,
            'response': response,
            'agent_id': agent_id,
            'model': model
        })
    except Exception as e:
        logger.error(f"Error en el chat: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API para procesar código y mejorarlo
@app.route('/api/process-code', methods=['POST'])
def process_code_api():
    """API para procesar y mejorar código."""
    code = request.json.get('code', '')
    language = request.json.get('language', 'python')
    instructions = request.json.get('instructions', 'Mejorar el código')

    if not code:
        return jsonify({
            'success': False,
            'error': 'Se requiere código para procesar'
        }), 400

    try:
        # En una implementación completa, aquí se conectaría con el servicio de IA
        # Por ahora, simulamos una respuesta con mejoras básicas

        improved_code = code

        # Simulamos algunas mejoras básicas según el lenguaje
        if language == 'python':
            # Añadir comentarios de docstring
            if 'def ' in code and '"""' not in code:
                improved_code = improved_code.replace('def ', 'def ', 1)
                improved_code = improved_code.replace(':', ':\n    """Descripción de la función.\n    \n    Returns:\n        Tipo de retorno: Descripción\n    """\n', 1)

            # Añadir if __name__ == '__main__' si no existe
            if 'if __name__ == ' not in code and len(code.strip().split('\n')) > 5:
                improved_code += '\n\nif __name__ == "__main__":\n    # Código para ejecutar cuando se llama directamente\n    pass\n'

        elif language == 'javascript':
            # Convertir var a let/const
            improved_code = improved_code.replace('var ', 'const ')

            # Añadir comentarios JSDoc si hay funciones
            if 'function ' in code and '/**' not in code:
                improved_code = improved_code.replace('function ', '/**\n * Descripción de la función.\n * @param {Tipo} parametro - Descripción del parámetro\n * @returns {Tipo} Descripción del valor de retorno\n */\nfunction ', 1)

        # Simulamos explicaciones de las mejoras
        explanations = [
            "He mejorado la documentación del código añadiendo docstrings o comentarios JSDoc.",
            "Estructura más clara y mantenible siguiendo las mejores prácticas.",
            "He seguido las convenciones de estilo estándar para " + language + "."
        ]

        suggestions = [
            "Considera añadir manejo de errores con try/except (Python) o try/catch (JavaScript).",
            "Es buena práctica validar los parámetros de entrada en las funciones.",
            "Considera escribir pruebas unitarias para este código."
        ]

        return jsonify({
            'success': True,
            'original_code': code,
            'improved_code': improved_code,
            'explanations': explanations,
            'suggestions': suggestions
        })
    except Exception as e:
        logger.error(f"Error al procesar código: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API para generar archivos complejos
@app.route('/api/generate-file', methods=['POST'])
def generate_file_api():
    """API para generar archivos complejos con agentes especializados."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    description = request.json.get('description')
    file_type = request.json.get('file_type', 'html')
    filename = request.json.get('filename', '')
    agent_id = request.json.get('agent_id', 'general')

    if not description:
        return jsonify({
            'success': False,
            'error': 'Se requiere una descripción del archivo a generar'
        }), 400

    try:
        # Generar nombre de archivo si no se proporciona
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            filename = f"generado_{timestamp}.{file_type}"

        # Asegurar que la extensión coincide con el tipo de archivo
        if not filename.endswith('.' + file_type):
            filename += '.' + file_type

        # Generar el archivo con el agente especializado
        workspace = get_user_workspace(user_id)
        result = create_file_with_agent(description, file_type, filename, agent_id, workspace)

        if not result['success']:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500

        # Notificar a clientes conectados
        socketio.emit('file_change', {
            'type': 'create',
            'file_path': filename
        }, room=user_id)

        return jsonify({
            'success': True,
            'file_path': filename,
            'content': result['content'],
            'agent_id': agent_id
        })
    except Exception as e:
        logger.error(f"Error al generar archivo: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API para procesar instrucciones en lenguaje natural
@app.route('/api/process-instruction', methods=['POST'])
def process_instruction_api():
    """API para procesar instrucciones en lenguaje natural."""
    user_id = request.json.get('user_id', session.get('user_id', 'default'))
    instruction = request.json.get('instruction')

    if not instruction:
        return jsonify({
            'success': False,
            'error': 'Se requiere una instrucción'
        }), 400

    try:
        # Detectar patrones en la instrucción
        # Patrón para crear archivo
        file_creation_match = re.search(r'crea(?:r)?\s+(?:un|el|una|la)?\s+archivo\s+(?:de)?\s+([a-zA-Z0-9]+)\s+(?:llamado|con\s+nombre)?\s+([a-zA-Z0-9._-]+)', instruction, re.IGNORECASE)

        # Patrón para ejecutar comando
        command_match = re.search(r'^ejecuta(?:r)?[:\s]+(.+)$', instruction, re.IGNORECASE)

        if file_creation_match:
            file_type = file_creation_match.group(1).lower()
            filename = file_creation_match.group(2)

            # Mapear tipos comunes
            type_mapping = {
                'python': 'py',
                'javascript': 'js',
                'html': 'html',
                'css': 'css',
                'texto': 'txt',
                'markdown': 'md',
                'json': 'json'
            }

            file_ext = type_mapping.get(file_type, file_type)

            # Asegurar que el filename tiene la extensión correcta
            if not filename.endswith('.' + file_ext):
                filename += '.' + file_ext

            # Crear el archivo con un contenido simple de ejemplo
            workspace = get_user_workspace(user_id)
            full_path = os.path.join(workspace, filename)

            # Contenido de ejemplo según el tipo
            if file_ext == 'py':
                content = '# Archivo Python generado\n\ndef main():\n    print("Hola mundo")\n\nif __name__ == "__main__":\n    main()\n'
            elif file_ext == 'js':
                content = '// Archivo JavaScript generado\n\nfunction main() {\n    console.log("Hola mundo");\n}\n\nmain();\n'
            elif file_ext == 'html':
                content = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Página generada</title>\n</head>\n<body>\n    <h1>Hola mundo</h1>\n</body>\n</html>\n'
            elif file_ext == 'css':
                content = '/* Archivo CSS generado */\n\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}\n'
            else:
                content = f'Archivo de {file_type} generado automáticamente.'

            # Crear directorios si no existen
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Escribir contenido
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return jsonify({
                'success': True,
                'action': 'create_file',
                'file_path': filename,
                'content': content
            })

        elif command_match:
            command = command_match.group(1).strip()

            # Ejecutar el comando
            workspace = get_user_workspace(user_id)

            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=workspace
            )

            stdout, stderr = process.communicate(timeout=30)
            status = process.returncode

            return jsonify({
                'success': True,
                'action': 'execute_command',
                'command': command,
                'stdout': stdout.decode('utf-8', errors='replace'),
                'stderr': stderr.decode('utf-8', errors='replace'),
                'status': status
            })

        else:
            # En una implementación completa, aquí se conectaría con un LLM para interpretar la instrucción
            return jsonify({
                'success': False,
                'error': 'No pude entender la instrucción. Intenta con "crear archivo de [tipo] llamado [nombre]" o "ejecutar: [comando]".'
            }), 400

    except Exception as e:
        logger.error(f"Error al procesar instrucción: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Socket.IO endpoints
@socketio.on('connect')
def handle_connect():
    """Manejar conexión de cliente a WebSocket."""
    logger.info("Client connected to WebSocket")
    emit('status', {'connected': True})

@socketio.on('disconnect')
def handle_disconnect():
    """Manejar desconexión de cliente de WebSocket."""
    logger.info("Client disconnected from WebSocket")

@socketio.on('join_workspace')
def handle_join_workspace(data):
    """Unirse a un workspace específico para actualizaciones en tiempo real."""
    workspace_id = data.get('workspace_id', 'default')
    logger.info(f"Client joined workspace: {workspace_id}")
    join_room(workspace_id)
    emit('workspace_update', {'status': 'connected', 'workspace_id': workspace_id})

@socketio.on('bash_command')
def handle_bash_command(data):
    """Ejecutar comandos bash vía Socket.IO."""
    try:
        command = data.get('command', '')
        user_id = data.get('user_id', 'default')

        if not command:
            emit('command_result', {
                'success': False,
                'error': 'Se requiere un comando para ejecutar'
            })
            return

        logger.info(f"Socket.IO - Ejecutando comando: '{command}'")

        # Ejecutar el comando
        workspace = get_user_workspace(user_id)

        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=workspace
        )

        stdout, stderr = process.communicate(timeout=30)
        status = process.returncode

        # Enviar resultado
        emit('command_result', {
            'success': status == 0,
            'command': command,
            'output': stdout.decode('utf-8', errors='replace'),
            'stderr': stderr.decode('utf-8', errors='replace'),
            'status': status
        })

    except Exception as e:
        logger.error(f"Error al ejecutar comando vía Socket.IO: {str(e)}")
        logger.error(traceback.format_exc())
        emit('command_result', {
            'success': False,
            'error': str(e)
        })

@socketio.on('natural_language')
def handle_natural_language(data):
    """Procesar instrucciones en lenguaje natural vía Socket.IO."""
    try:
        text = data.get('text', '')
        user_id = data.get('user_id', 'default')

        if not text:
            emit('assistant_response', {
                'success': False,
                'error': 'Se requiere texto para procesar'
            })
            return

        logger.info(f"Socket.IO - Procesando lenguaje natural: '{text}'")

        # Detectar patrones en la instrucción
        # Patrón para crear archivo
        file_creation_match = re.search(r'crea(?:r)?\s+(?:un|el|una|la)?\s+(?:archivo|página|componente)\s+(?:de)?\s+([a-zA-Z0-9]+)\s+(?:llamado|con\s+nombre)?\s+([a-zA-Z0-9._-]+)?', text, re.IGNORECASE)

        # Patrón para ejecutar comando
        command_match = re.search(r'ejecuta(?:r)?[:\s]+(.+)$', text, re.IGNORECASE)

        if file_creation_match:
            file_type = file_creation_match.group(1).lower() if file_creation_match.group(1) else 'html'
            filename = file_creation_match.group(2) if file_creation_match.group(2) else f"nuevo_{file_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

            # Mapear tipos comunes
            type_mapping = {
                'python': 'py',
                'javascript': 'js',
                'html': 'html',
                'css': 'css',
                'texto': 'txt',
                'markdown': 'md',
                'json': 'json',
                'web': 'html',
                'página': 'html',
                'pagina': 'html'
            }

            file_ext = type_mapping.get(file_type, file_type)

            # Asegurar que el filename tiene la extensión correcta
            if not filename.endswith('.' + file_ext):
                filename += '.' + file_ext

            # Crear el archivo con un contenido generado
            workspace = get_user_workspace(user_id)
            full_path = os.path.join(workspace, filename)

            # Intentar generar contenido con IA si está configurada
            content = None

            # Si hay una API de IA configurada, usarla para generar contenido
            if os.environ.get('OPENAI_API_KEY') or os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('GEMINI_API_KEY'):
                try:
                    # Usar la función existente para generar contenido
                    result = create_file_with_agent(text, file_ext, filename, 'developer', workspace)
                    if result['success']:
                        content = result['content']
                except Exception as e:
                    logger.error(f"Error al generar contenido con IA: {str(e)}")

            # Si no se pudo generar con IA, usar contenido predeterminado
            if not content:
                if file_ext == 'py':
                    content = '# Archivo Python generado\n\ndef main():\n    print("Hola mundo")\n\nif __name__ == "__main__":\n    main()\n'
                elif file_ext == 'js':
                    content = '// Archivo JavaScript generado\n\nfunction main() {\n    console.log("Hola mundo");\n}\n\nmain();\n'
                elif file_ext == 'html':
                    content = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Página generada</title>\n</head>\n<body>\n    <h1>Hola mundo</h1>\n</body>\n</html>\n'
                elif file_ext == 'css':
                    content = '/* Archivo CSS generado */\n\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}\n'
                else:
                    content = f'Archivo de {file_type} generado automáticamente.'

            # Crear directorios si no existen
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Escribir contenido
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Notificar a clientes conectados
            socketio.emit('file_change', {
                'type': 'create',
                'file_path': filename
            }, room=user_id)

            emit('assistant_response', {
                'success': True,
                'message': f'Archivo {filename} creado exitosamente',
                'type': 'createFile',
                'fileInfo': {
                    'name': filename,
                    'path': filename
                },
                'content': content,
                'explanation': f'He creado un archivo {file_type} llamado {filename} según tu solicitud.'
            })

        elif command_match:
            command = command_match.group(1).strip()

            # Ejecutar el comando
            workspace = get_user_workspace(user_id)

            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=workspace
            )

            stdout, stderr = process.communicate(timeout=30)
            status = process.returncode

            # Notificar a clientes conectados
            socketio.emit('command_executed', {
                'command': command,
                'output': stdout.decode('utf-8', errors='replace'),
                'error': stderr.decode('utf-8', errors='replace'),
                'status': status
            }, room=user_id)

            emit('assistant_response', {
                'success': True,
                'message': f'Comando ejecutado: {command}',
                'type': 'executeCommand',
                'command': command,
                'commandInfo': {
                    'command': command,
                    'status': status
                },
                'output': stdout.decode('utf-8', errors='replace'),
                'error': stderr.decode('utf-8', errors='replace'),
                'explanation': f'He ejecutado el comando: {command}'
            })

        else:
            # En una implementación completa, aquí se conectaría con un LLM para interpretar la instrucción
            # Por ahora, devolver una respuesta genérica
            emit('assistant_response', {
                'success': True,
                'message': f'He procesado tu solicitud: {text}',
                'type': 'generic',
                'explanation': f'He procesado la instrucción: "{text}"'
            })

    except Exception as e:
        logger.error(f"Error al procesar lenguaje natural vía Socket.IO: {str(e)}")
        logger.error(traceback.format_exc())
        emit('assistant_response', {
            'success': False,
            'error': str(e)
        })

# Punto de entrada de la aplicación
if __name__ == '__main__':
    import re
    socketio.run(app, host='127.0.0.1', port=5000, debug=True)

# API para procesar lenguaje natural (para la interfaz estilo Augment)
@app.route('/api/process_natural', methods=['POST'])
def process_natural_api():
    """API para procesar instrucciones en lenguaje natural para la interfaz estilo Augment."""
    try:
        data = request.json
        text = data.get('text', '')
        model = data.get('model', 'gemini')
        user_id = data.get('user_id', session.get('user_id', 'default'))

        if not text:
            return jsonify({
                'success': False,
                'error': 'Se requiere texto para procesar'
            }), 400

        logger.info(f"Procesando lenguaje natural: '{text}'")

        # Detectar patrones en la instrucción
        # Patrón para crear archivo
        file_creation_match = re.search(r'crea(?:r)?\s+(?:un|el|una|la)?\s+(?:archivo|página|componente)\s+(?:de)?\s+([a-zA-Z0-9]+)\s+(?:llamado|con\s+nombre)?\s+([a-zA-Z0-9._-]+)?', text, re.IGNORECASE)

        # Patrón para ejecutar comando
        command_match = re.search(r'ejecuta(?:r)?[:\s]+(.+)$', text, re.IGNORECASE)

        if file_creation_match:
            file_type = file_creation_match.group(1).lower() if file_creation_match.group(1) else 'html'
            filename = file_creation_match.group(2) if file_creation_match.group(2) else f"nuevo_{file_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

            # Mapear tipos comunes
            type_mapping = {
                'python': 'py',
                'javascript': 'js',
                'html': 'html',
                'css': 'css',
                'texto': 'txt',
                'markdown': 'md',
                'json': 'json',
                'web': 'html',
                'página': 'html',
                'pagina': 'html'
            }

            file_ext = type_mapping.get(file_type, file_type)

            # Asegurar que el filename tiene la extensión correcta
            if not filename.endswith('.' + file_ext):
                filename += '.' + file_ext

            # Crear el archivo con un contenido generado
            workspace = get_user_workspace(user_id)
            full_path = os.path.join(workspace, filename)

            # Intentar generar contenido con IA si está configurada
            content = None

            # Si hay una API de IA configurada, usarla para generar contenido
            if os.environ.get('OPENAI_API_KEY') or os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('GEMINI_API_KEY'):
                try:
                    # Usar la función existente para generar contenido
                    result = create_file_with_agent(text, file_ext, filename, 'developer', workspace)
                    if result['success']:
                        content = result['content']
                except Exception as e:
                    logger.error(f"Error al generar contenido con IA: {str(e)}")

            # Si no se pudo generar con IA, usar contenido predeterminado
            if not content:
                if file_ext == 'py':
                    content = '# Archivo Python generado\n\ndef main():\n    print("Hola mundo")\n\nif __name__ == "__main__":\n    main()\n'
                elif file_ext == 'js':
                    content = '// Archivo JavaScript generado\n\nfunction main() {\n    console.log("Hola mundo");\n}\n\nmain();\n'
                elif file_ext == 'html':
                    content = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Página generada</title>\n</head>\n<body>\n    <h1>Hola mundo</h1>\n</body>\n</html>\n'
                elif file_ext == 'css':
                    content = '/* Archivo CSS generado */\n\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}\n'
                else:
                    content = f'Archivo de {file_type} generado automáticamente.'

            # Crear directorios si no existen
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Escribir contenido
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Notificar a clientes conectados
            socketio.emit('file_change', {
                'type': 'create',
                'file_path': filename
            }, room=user_id)

            return jsonify({
                'success': True,
                'message': f'Archivo {filename} creado exitosamente',
                'type': 'createFile',
                'fileInfo': {
                    'name': filename,
                    'path': filename
                },
                'content': content,
                'explanation': f'He creado un archivo {file_type} llamado {filename} según tu solicitud.'
            })

        elif command_match:
            command = command_match.group(1).strip()

            # Ejecutar el comando
            workspace = get_user_workspace(user_id)

            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=workspace
            )

            stdout, stderr = process.communicate(timeout=30)
            status = process.returncode

            # Notificar a clientes conectados
            socketio.emit('command_executed', {
                'command': command,
                'output': stdout.decode('utf-8', errors='replace'),
                'error': stderr.decode('utf-8', errors='replace'),
                'status': status
            }, room=user_id)

            return jsonify({
                'success': True,
                'message': f'Comando ejecutado: {command}',
                'type': 'executeCommand',
                'command': command,
                'commandInfo': {
                    'command': command,
                    'status': status
                },
                'output': stdout.decode('utf-8', errors='replace'),
                'error': stderr.decode('utf-8', errors='replace'),
                'explanation': f'He ejecutado el comando: {command}'
            })

        else:
            # En una implementación completa, aquí se conectaría con un LLM para interpretar la instrucción
            # Por ahora, devolver una respuesta genérica
            return jsonify({
                'success': True,
                'message': f'He procesado tu solicitud: {text}',
                'type': 'generic',
                'explanation': f'He procesado la instrucción: "{text}"'
            })

    except Exception as e:
        logger.error(f"Error al procesar lenguaje natural: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Agregar estas rutas cerca de las otras definiciones de rutas API

@app.route('/api/health', methods=['GET'])
def api_health_check():
    """Check the health status of the application."""
    try:
        # Check API configurations
        apis = {
            "openai": "ok" if os.environ.get('OPENAI_API_KEY') else "not configured",
            "anthropic": "ok" if os.environ.get('ANTHROPIC_API_KEY') else "not configured",
            "gemini": "ok" if os.environ.get('GEMINI_API_KEY') else "not configured"
        }

        return jsonify({
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0",
            "apis": apis
        })
    except Exception as e:
        logger.error(f"Error in health check: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/health', methods=['GET'])
def simple_health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "ok", "message": "Server is running"}), 200

@app.route('/api/session', methods=['GET'])
def get_session():
    """Get session information."""
    return jsonify({
        "user_id": "default",
        "workspace": "default",
        "session_id": str(uuid.uuid4()),
        "created_at": datetime.now().isoformat()
    })












