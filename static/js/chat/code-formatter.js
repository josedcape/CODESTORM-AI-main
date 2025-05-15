
/**
 * Formateador de código para el chat interactivo
 * Ayuda a mostrar y renderizar código en el chat del agente
 */

// Función para resaltar sintaxis en bloques de código
function highlightCode(code, language) {
  // Si hljs no está disponible, devolver el código con escape HTML básico
  if (typeof hljs === 'undefined') {
    return escapeHtml(code);
  }

  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, {language: language}).value;
    } else {
      return hljs.highlightAuto(code).value;
    }
  } catch (e) {
    console.error("Error al resaltar código:", e);
    return escapeHtml(code);
  }
}

// Función para escapar HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Función para formatear el código de la respuesta del asistente
function formatCodeResponse(response) {
  if (!response) return '';

  // Reemplazar bloques de código con formato
  let formattedResponse = response.replace(/```(\w*)\n([\s\S]+?)```/g, function(match, language, code) {
    language = language.trim() || 'plaintext';

    const highlightedCode = highlightCode(code, language);

    return `<div class="code-block-container">
      <div class="code-toolbar">
        <span class="code-language">${language}</span>
        <button class="btn btn-sm btn-dark code-copy-btn" onclick="copyCode(this)" title="Copiar código">
          <i class="bi bi-clipboard"></i> Copiar
        </button>
      </div>
      <pre><code class="language-${language}">${highlightedCode}</code></pre>
    </div>`;
  });

  // Reemplazar código en línea
  formattedResponse = formattedResponse.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Convertir saltos de línea a etiquetas <br>
  formattedResponse = formattedResponse.replace(/\n/g, '<br>');

  return formattedResponse;
}

// Función para copiar código al portapapeles
function copyCode(button) {
  // Encontrar el contenedor y el elemento de código
  const codeContainer = button.closest('.code-block-container');
  if (!codeContainer) {
    console.error('No se pudo encontrar el contenedor de código');
    return;
  }

  const preElement = codeContainer.querySelector('pre');
  const codeElement = preElement.querySelector('code');

  if (!codeElement) {
    console.error('No se pudo encontrar el elemento de código');
    return;
  }

  // Obtener el texto real sin formato HTML
  const textToCopy = codeElement.textContent || codeElement.innerText;

  // Crear un elemento de texto temporal para copiar
  const textArea = document.createElement('textarea');
  textArea.value = textToCopy;
  textArea.style.position = 'fixed';  // Evita desplazamiento
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    // Intentar usar el nuevo API de clipboard si está disponible
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Éxito - cambia el botón para dar feedback
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check"></i>';
        button.style.backgroundColor = '#28a745';

        // Mostrar una notificación de éxito temporal
        showNotification('Código copiado al portapapeles');

        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.backgroundColor = '';
        }, 2000);
      }).catch(err => {
        console.error('Error al copiar texto: ', err);
        fallbackCopy();
      });
    } else {
      // Fallback para navegadores que no soportan clipboard API
      fallbackCopy();
    }
  } catch (err) {
    console.error('Error al copiar el código: ', err);
    fallbackCopy();
  }

  // Método alternativo de copia
  function fallbackCopy() {
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        button.innerHTML = '<i class="bi bi-check"></i>';
        button.style.backgroundColor = '#28a745';
        showNotification('Código copiado al portapapeles');
      } else {
        button.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
        button.style.backgroundColor = '#dc3545';
        showNotification('No se pudo copiar el código', 'error');
      }
    } catch (err) {
      console.error('Error en el fallback de copia: ', err);
      button.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
      button.style.backgroundColor = '#dc3545';
    }

    setTimeout(() => {
      button.innerHTML = '<i class="bi bi-clipboard"></i>';
      button.style.backgroundColor = '';
    }, 2000);
  }

  // Limpiar
  document.body.removeChild(textArea);
}

// Función para mostrar notificaciones de copia
function showNotification(message, type = 'success') {
  // Verificar si ya existe un contenedor de notificaciones
  let notificationContainer = document.getElementById('notification-container');

  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '9999';
    document.body.appendChild(notificationContainer);
  }

  // Crear la notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.padding = '10px 15px';
  notification.style.margin = '5px 0';
  notification.style.borderRadius = '4px';
  notification.style.color = 'white';
  notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  notification.style.transition = 'all 0.3s ease';
  notification.style.opacity = '0';
  notification.style.transform = 'translateY(-20px)';

  // Estilos según el tipo
  if (type === 'success') {
    notification.style.backgroundColor = '#28a745';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#dc3545';
  } else {
    notification.style.backgroundColor = '#17a2b8';
  }

  notification.textContent = message;

  // Añadir al contenedor
  notificationContainer.appendChild(notification);

  // Animar entrada
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);

  // Eliminar después de un tiempo
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Función para mostrar notificaciones si no existe globalmente
if (!window.showNotification) {
  window.showNotification = function(message, type) {
    showNotification(message, type);
  };
}

// Función para actualizar la UI cuando se cambia de agente
function updateAgentUI(agentId) {
    if (!window.app || !window.app.chat || !window.app.chat.availableAgents) {
        console.error('No se encuentran los datos de agentes');
        return;
    }

    const agent = window.app.chat.availableAgents[agentId];
    if (!agent) {
        console.error(`Agente no encontrado: ${agentId}`);
        return;
    }

    // Actualizar nombre y descripción del agente
    const agentNameElement = document.getElementById('agent-badge');
    const agentDescElement = document.querySelector('.agent-description');
    const agentIcon = document.querySelector('.agent-icon i');

    if (agentNameElement) {
        agentNameElement.textContent = agent.name;
    }

    if (agentDescElement) {
        agentDescElement.textContent = agent.description;
    }

    if (agentIcon) {
        agentIcon.className = '';
        agentIcon.classList.add('bi', `bi-${agent.icon}`);
    }

    // Actualizar lista de capacidades
    const capabilitiesList = document.getElementById('agent-capabilities');
    if (capabilitiesList && agent.capabilities) {
        capabilitiesList.innerHTML = '';
        agent.capabilities.forEach(capability => {
            const li = document.createElement('li');
            li.textContent = capability;
            capabilitiesList.appendChild(li);
        });
    }

    // Añadir mensaje de sistema
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message-container system-message';
    systemMessage.innerHTML = `<div class="message-content">Has cambiado al <strong>${agent.name}</strong>. ${agent.description}</div>`;

    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.appendChild(systemMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Guardar el agente activo en la configuración
    window.app.chat.activeAgent = agentId;

    console.log(`Agente cambiado a: ${agent.name} (${agentId})`);
}

/**
 * Formateador de código para la interfaz de chat
 * Este script se encarga de formatear correctamente los bloques de código en los mensajes del chat
 */
document.addEventListener('DOMContentLoaded', function() {
    // Función para formatear bloques de código en el contenido HTML
    function formatCodeBlocks(htmlContent) {
        if (!htmlContent) return htmlContent;

        // Buscar todos los bloques de código (```lenguaje ... ```)
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

        // Reemplazar con un formato HTML adecuado
        return htmlContent.replace(codeBlockRegex, function(match, language, code) {
            // Escapar HTML para evitar inyección
            const escapedCode = code
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            return `<div class="code-block"><div class="code-header">${language || 'código'}</div><pre><code class="language-${language || 'plaintext'}">${escapedCode}</code></pre></div>`;
        });
    }

    // Función para agregar estilos de código
    function addCodeStyles() {
        if (document.getElementById('code-formatter-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'code-formatter-styles';
        styleElement.textContent = `
            .code-block {
                background-color: #1e1e1e;
                border-radius: 6px;
                margin: 10px 0;
                overflow: hidden;
            }

            .code-header {
                background-color: #2d2d2d;
                color: #e0e0e0;
                padding: 6px 12px;
                font-family: monospace;
                font-size: 12px;
                text-transform: uppercase;
                border-bottom: 1px solid #3d3d3d;
            }

            .code-block pre {
                margin: 0;
                padding: 12px;
                white-space: pre-wrap;
                word-wrap: break-word;
                color: #e0e0e0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.4;
                background-color: transparent;
                overflow-x: auto;
            }

            .code-block code {
                background-color: transparent;
                padding: 0;
            }

            /* Colores de sintaxis básicos */
            .language-javascript .keyword { color: #569CD6; }
            .language-javascript .string { color: #CE9178; }
            .language-javascript .number { color: #B5CEA8; }
            .language-javascript .comment { color: #6A9955; }

            .language-html .tag { color: #569CD6; }
            .language-html .attr { color: #9CDCFE; }
            .language-html .string { color: #CE9178; }

            .language-css .property { color: #9CDCFE; }
            .language-css .value { color: #CE9178; }
        `;

        document.head.appendChild(styleElement);
    }

    // Observar cambios en el DOM para formatear código en nuevos mensajes
    function observeMessages() {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        // Crear un observador
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.classList.contains('message') && 
                        node.classList.contains('assistant-message')) {
                        // Es un mensaje del asistente, formatear su contenido
                        const formattedContent = formatCodeBlocks(node.innerHTML);
                        node.innerHTML = formattedContent;
                    }
                });
            });
        });

        // Configurar y comenzar la observación
        observer.observe(messagesContainer, { childList: true });
    }

    // Inicializar formateador
    function initCodeFormatter() {
        addCodeStyles();
        observeMessages();
        console.log('Formateador de código inicializado');
    }

    // Iniciar el formateador
    initCodeFormatter();
});

// Clase CodeFormatter para manejar el formateo de código con métodos avanzados
class CodeFormatterHelper {
    constructor() {
        console.log('CodeFormatterHelper inicializado');
    }
    
    /**
     * Detecta y formatea bloques de código en un mensaje
     * @param {string} message - El mensaje a formatear
     * @return {string} - Mensaje con código formateado en HTML
     */
    formatCode(message) {
        // Detectar bloques de código con triple backtick
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;

        // Reemplazar bloques de código con elementos <pre><code>
        let formattedMessage = message.replace(codeBlockRegex, (match, language, code) => {
            const langClass = language ? `language-${language}` : '';
            return `<pre><code class="${langClass}">${this.escapeHtml(code)}</code></pre>`;
        });

        // Detectar código en línea con backtick simple
        const inlineCodeRegex = /`([^`]+)`/g;
        formattedMessage = formattedMessage.replace(inlineCodeRegex, '<code>$1</code>');

        return formattedMessage;
    }

    /**
     * Escapa caracteres HTML para mostrar código correctamente
     * @param {string} html - Texto a escapar
     * @return {string} - Texto con caracteres HTML escapados
     */
    escapeHtml(html) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return html.replace(/[&<>"']/g, function(m) {
            return escapeMap[m];
        });
    }

    /**
     * Aplica resaltado de sintaxis a los bloques de código
     */
    highlightAll() {
        // Si se usa una biblioteca como Prism.js o highlight.js
        if (typeof Prism !== 'undefined') {
            Prism.highlightAll();
        } else if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        }
    }
    
    /**
     * Copia texto al portapapeles
     * @param {string} text - Texto a copiar
     */
    copyToClipboard(text) {
        // Crear elemento temporal
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        
        // Seleccionar y copiar
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        
        // Mostrar notificación
        if (window.showNotification) {
            window.showNotification('Código copiado al portapapeles', 'success');
        } else {
            console.log('Código copiado al portapapeles');
        }
    }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  window.codeFormatter = new CodeFormatterHelper();
});

// Exponer la función de copia globalmente para que pueda ser usada por botones
window.copyCodeToClipboard = function(element) {
  const codeBlock = element.closest('.code-block').querySelector('code');
  if (codeBlock) {
    window.codeFormatter.copyToClipboard(codeBlock.textContent);
  }
};

// Exponer funciones globalmente
window.highlightCode = highlightCode;
window.formatCodeResponse = formatCodeResponse;
window.copyCode = copyCode;
window.updateAgentUI = updateAgentUI;
