/**
 * CODESTORM - Procesador Avanzado de Lenguaje Natural (Estilo Augment)
 * Este módulo permite interpretar instrucciones en lenguaje natural y ejecutar acciones complejas
 * como crear archivos, modificar código y ejecutar comandos automáticamente.
 */

class AugmentLikeProcessor {
    constructor() {
        this.fileActions = window.fileActions || {};
        this.terminalIntegration = window.terminalIntegration || {};
        this.currentWorkspace = './';
        this.lastCreatedFiles = [];
        this.lastModifiedFiles = [];
        this.pendingActions = [];
        this.actionHistory = [];

        // Patrones para identificar tipos de solicitudes
        this.patterns = {
            createFile: [
                /crear (un |una |el |la )?(archivo|fichero|documento|página|componente)/i,
                /generar (un |una |el |la )?(archivo|fichero|documento|página|componente)/i,
                /nuevo (archivo|fichero|documento|página|componente)/i,
                /nueva (página|aplicación)/i
            ],
            modifyFile: [
                /modificar (el |la |los |las )?(archivo|fichero|documento|página|componente)/i,
                /cambiar (el |la |los |las )?(archivo|fichero|documento|página|componente)/i,
                /actualizar (el |la |los |las )?(archivo|fichero|documento|página|componente)/i,
                /editar (el |la |los |las )?(archivo|fichero|documento|página|componente)/i
            ],
            executeCommand: [
                /ejecutar (el |la |los |las )?(comando|script|programa)/i,
                /correr (el |la |los |las )?(comando|script|programa)/i,
                /instalar/i,
                /iniciar (el |la |los |las )?(servidor|aplicación|app)/i
            ],
            projectSetup: [
                /crear (un |una |el |la )?(proyecto|aplicación|app)/i,
                /configurar (un |una |el |la )?(proyecto|aplicación|app)/i,
                /inicializar (un |una |el |la )?(proyecto|aplicación|app)/i,
                /setup (de |para |del )?(proyecto|aplicación|app)/i
            ]
        };

        // Tipos de archivos comunes y sus extensiones
        this.fileTypes = {
            html: {
                keywords: ['html', 'página web', 'página', 'web', 'sitio'],
                extension: '.html',
                template: '<!DOCTYPE html>\n<html lang="es">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>{{title}}</title>\n</head>\n<body>\n    <h1>{{title}}</h1>\n    <p>{{content}}</p>\n</body>\n</html>'
            },
            css: {
                keywords: ['css', 'estilo', 'estilos', 'hoja de estilo'],
                extension: '.css',
                template: '/* {{title}} */\n\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n    background-color: #f5f5f5;\n    color: #333;\n}\n\nh1 {\n    color: #2c3e50;\n}\n'
            },
            javascript: {
                keywords: ['javascript', 'js', 'script', 'función'],
                extension: '.js',
                template: '/**\n * {{title}}\n */\n\n// Función principal\nfunction main() {\n    console.log("{{content}}");\n}\n\n// Ejecutar cuando el documento esté listo\ndocument.addEventListener("DOMContentLoaded", main);'
            },
            react: {
                keywords: ['react', 'componente', 'jsx', 'tsx'],
                extension: '.jsx',
                template: 'import React from "react";\n\n/**\n * {{title}}\n */\nfunction {{componentName}}() {\n    return (\n        <div className="{{className}}">\n            <h2>{{title}}</h2>\n            <p>{{content}}</p>\n        </div>\n    );\n}\n\nexport default {{componentName}};'
            },
            python: {
                keywords: ['python', 'py', 'script python'],
                extension: '.py',
                template: '#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n\n"""\n{{title}}\n"""\n\ndef main():\n    """Función principal"""\n    print("{{content}}")\n\nif __name__ == "__main__":\n    main()'
            }
        };
    }

    /**
     * Procesa una solicitud en lenguaje natural
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processRequest(request) {
        console.log('Procesando solicitud:', request);

        // Normalizar la solicitud
        const normalizedRequest = request.trim();

        // Identificar el tipo de solicitud
        const requestType = this.identifyRequestType(normalizedRequest);
        console.log('Tipo de solicitud identificado:', requestType);

        // Procesar según el tipo de solicitud
        let result;
        switch (requestType) {
            case 'createFile':
                result = await this.processCreateFileRequest(normalizedRequest);
                break;
            case 'modifyFile':
                result = await this.processModifyFileRequest(normalizedRequest);
                break;
            case 'executeCommand':
                result = await this.processExecuteCommandRequest(normalizedRequest);
                break;
            case 'projectSetup':
                result = await this.processProjectSetupRequest(normalizedRequest);
                break;
            default:
                // Si no se identifica un tipo específico, intentar procesamiento genérico
                result = await this.processGenericRequest(normalizedRequest);
        }

        // Registrar la acción en el historial
        this.actionHistory.push({
            request: normalizedRequest,
            type: requestType,
            result: result,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Identifica el tipo de solicitud basado en patrones
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {string} Tipo de solicitud
     */
    identifyRequestType(request) {
        // Verificar cada tipo de patrón
        for (const [type, patternList] of Object.entries(this.patterns)) {
            for (const pattern of patternList) {
                if (pattern.test(request)) {
                    return type;
                }
            }
        }

        // Si no coincide con ningún patrón específico, devolver genérico
        return 'generic';
    }

    /**
     * Procesa una solicitud para crear un archivo
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processCreateFileRequest(request) {
        console.log('Procesando solicitud de creación de archivo:', request);

        // Extraer información relevante de la solicitud
        const fileInfo = this.extractFileInfo(request);
        console.log('Información del archivo extraída:', fileInfo);

        // Generar contenido para el archivo según el tipo
        const fileContent = this.generateFileContent(fileInfo);

        // Crear el archivo
        try {
            const result = await this.createFile(fileInfo.name, fileContent);

            // Registrar el archivo creado
            this.lastCreatedFiles.push(fileInfo.name);

            return {
                success: true,
                type: 'createFile',
                message: `Archivo ${fileInfo.name} creado exitosamente.`,
                fileInfo: fileInfo,
                content: fileContent
            };
        } catch (error) {
            console.error('Error al crear archivo:', error);
            return {
                success: false,
                type: 'createFile',
                message: `Error al crear archivo: ${error.message}`,
                fileInfo: fileInfo
            };
        }
    }

    /**
     * Procesa una solicitud para modificar un archivo
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processModifyFileRequest(request) {
        console.log('Procesando solicitud de modificación de archivo:', request);

        // Extraer información relevante de la solicitud
        const modificationInfo = this.extractModificationInfo(request);
        console.log('Información de modificación extraída:', modificationInfo);

        // Si no se especificó un archivo, usar el último archivo creado
        if (!modificationInfo.fileName && this.lastCreatedFiles.length > 0) {
            modificationInfo.fileName = this.lastCreatedFiles[this.lastCreatedFiles.length - 1];
        }

        // Verificar que el archivo existe
        if (!modificationInfo.fileName) {
            return {
                success: false,
                type: 'modifyFile',
                message: 'No se especificó un archivo para modificar y no hay archivos recientes.'
            };
        }

        try {
            // Leer el contenido actual del archivo
            const currentContent = await this.readFile(modificationInfo.fileName);

            // Aplicar las modificaciones al contenido
            const newContent = this.applyModifications(currentContent, modificationInfo);

            // Guardar el archivo modificado
            const result = await this.saveFile(modificationInfo.fileName, newContent);

            // Registrar el archivo modificado
            this.lastModifiedFiles.push(modificationInfo.fileName);

            return {
                success: true,
                type: 'modifyFile',
                message: `Archivo ${modificationInfo.fileName} modificado exitosamente.`,
                modificationInfo: modificationInfo,
                originalContent: currentContent,
                newContent: newContent
            };
        } catch (error) {
            console.error('Error al modificar archivo:', error);
            return {
                success: false,
                type: 'modifyFile',
                message: `Error al modificar archivo: ${error.message}`,
                modificationInfo: modificationInfo
            };
        }
    }

    /**
     * Procesa una solicitud para ejecutar un comando
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processExecuteCommandRequest(request) {
        console.log('Procesando solicitud de ejecución de comando:', request);

        // Extraer el comando de la solicitud
        const commandInfo = this.extractCommandInfo(request);
        console.log('Información del comando extraída:', commandInfo);

        try {
            // Ejecutar el comando
            const result = await this.executeCommand(commandInfo.command);

            return {
                success: true,
                type: 'executeCommand',
                message: `Comando ejecutado exitosamente: ${commandInfo.command}`,
                commandInfo: commandInfo,
                result: result
            };
        } catch (error) {
            console.error('Error al ejecutar comando:', error);
            return {
                success: false,
                type: 'executeCommand',
                message: `Error al ejecutar comando: ${error.message}`,
                commandInfo: commandInfo
            };
        }
    }

    /**
     * Procesa una solicitud para configurar un proyecto
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processProjectSetupRequest(request) {
        console.log('Procesando solicitud de configuración de proyecto:', request);

        // Extraer información del proyecto
        const projectInfo = this.extractProjectInfo(request);
        console.log('Información del proyecto extraída:', projectInfo);

        // Lista de acciones a realizar
        const actions = this.generateProjectSetupActions(projectInfo);

        // Ejecutar las acciones secuencialmente
        const results = [];
        for (const action of actions) {
            try {
                let result;
                switch (action.type) {
                    case 'createFile':
                        result = await this.createFile(action.fileName, action.content);
                        this.lastCreatedFiles.push(action.fileName);
                        break;
                    case 'executeCommand':
                        result = await this.executeCommand(action.command);
                        break;
                }

                results.push({
                    action: action,
                    success: true,
                    result: result
                });
            } catch (error) {
                console.error(`Error al ejecutar acción ${action.type}:`, error);
                results.push({
                    action: action,
                    success: false,
                    error: error.message
                });
            }
        }

        // Determinar si todas las acciones fueron exitosas
        const allSuccessful = results.every(r => r.success);

        return {
            success: allSuccessful,
            type: 'projectSetup',
            message: allSuccessful
                ? `Proyecto ${projectInfo.name} configurado exitosamente.`
                : 'Hubo errores al configurar el proyecto.',
            projectInfo: projectInfo,
            actions: actions,
            results: results
        };
    }

    /**
     * Procesa una solicitud genérica
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Resultado del procesamiento
     */
    async processGenericRequest(request) {
        console.log('Procesando solicitud genérica:', request);

        // Verificar si hay Socket.IO disponible
        if (window.socket && typeof window.socket.emit === 'function') {
            console.log('Usando Socket.IO para procesar lenguaje natural');
            return new Promise((resolve, reject) => {
                try {
                    // Crear un listener temporal para la respuesta
                    const responseHandler = (data) => {
                        console.log('Respuesta de Socket.IO recibida:', data);
                        window.socket.off('assistant_response', responseHandler);

                        if (data.success) {
                            // Si hay un comando, preparar para ejecutarlo
                            if (data.command) {
                                data.type = 'executeCommand';
                                data.commandInfo = { command: data.command };
                            }

                            // Si hay contenido de archivo, preparar para mostrarlo
                            if (data.content && (data.type === 'createFile' || data.fileInfo)) {
                                data.type = 'createFile';
                            }

                            resolve(data);
                        } else {
                            reject(new Error(data.error || 'Error al procesar lenguaje natural'));
                        }
                    };

                    // Establecer un timeout
                    const timeoutId = setTimeout(() => {
                        window.socket.off('assistant_response', responseHandler);
                        reject(new Error('Timeout al procesar lenguaje natural'));
                    }, 30000);

                    // Registrar el listener
                    window.socket.on('assistant_response', responseHandler);

                    // Enviar la solicitud
                    window.socket.emit('natural_language', {
                        text: request,
                        user_id: 'default'
                    });

                } catch (error) {
                    console.error('Error al usar Socket.IO:', error);
                    reject(error);
                }
            });
        } else {
            // Fallback a fetch API
            console.log('Usando fetch API para procesar lenguaje natural');
            try {
                console.log('Enviando solicitud a /api/process_natural');
                const response = await fetch('/api/process_natural', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: request,
                        model: 'gemini',
                        user_id: 'default'
                    })
                });

                console.log('Respuesta recibida:', response);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error en la solicitud: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();
                console.log('Datos recibidos:', data);

                if (data.success) {
                    // Si el servidor devolvió un comando, ejecutarlo
                    if (data.command) {
                        try {
                            const result = await this.executeCommand(data.command);
                            return {
                                success: true,
                                type: 'executeCommand',
                                message: data.response || `Comando ejecutado: ${data.command}`,
                                command: data.command,
                                result: result
                            };
                        } catch (error) {
                            return {
                                success: false,
                                type: 'executeCommand',
                                message: `Error al ejecutar comando: ${error.message}`,
                                command: data.command
                            };
                        }
                    }

                    // Si solo hay respuesta, mostrarla
                    return {
                        success: true,
                        type: 'generic',
                        message: data.response || 'Solicitud procesada correctamente.'
                    };
                } else {
                    return {
                        success: false,
                        type: 'generic',
                        message: data.error || 'Error al procesar la solicitud.'
                    };
                }
            } catch (error) {
                console.error('Error al procesar solicitud genérica:', error);
                return {
                    success: false,
                    type: 'generic',
                    message: `Error al procesar solicitud: ${error.message}`
                };
            }
        }
    }

    /**
     * Extrae información de un archivo a partir de una solicitud
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Información del archivo
     */
    extractFileInfo(request) {
        // Valores predeterminados
        const fileInfo = {
            type: 'html',
            name: 'index.html',
            title: 'Página Web',
            content: 'Contenido de la página',
            description: request
        };

        // Detectar tipo de archivo
        for (const [type, info] of Object.entries(this.fileTypes)) {
            for (const keyword of info.keywords) {
                if (request.toLowerCase().includes(keyword.toLowerCase())) {
                    fileInfo.type = type;
                    fileInfo.name = `index${info.extension}`;
                    break;
                }
            }
        }

        // Extraer nombre de archivo si se especifica
        const fileNameMatch = request.match(/(?:archivo|fichero|documento|página|componente)\s+(?:llamado|nombrado|con nombre|con el nombre)?\s+["']?([a-zA-Z0-9_\-\.]+)["']?/i);
        if (fileNameMatch && fileNameMatch[1]) {
            let fileName = fileNameMatch[1];

            // Asegurarse de que tenga la extensión correcta
            const extension = this.fileTypes[fileInfo.type].extension;
            if (!fileName.endsWith(extension)) {
                fileName += extension;
            }

            fileInfo.name = fileName;
        }

        // Extraer título si se especifica
        const titleMatch = request.match(/(?:título|titulo|title|encabezado)\s+["']?([^"']+)["']?/i);
        if (titleMatch && titleMatch[1]) {
            fileInfo.title = titleMatch[1];
        }

        // Para componentes React, extraer nombre del componente
        if (fileInfo.type === 'react') {
            let componentName = fileInfo.name.replace(/\.jsx$/, '');
            componentName = componentName.charAt(0).toUpperCase() + componentName.slice(1);
            fileInfo.componentName = componentName;
            fileInfo.className = componentName.toLowerCase();
        }

        return fileInfo;
    }

    /**
     * Genera contenido para un archivo según su tipo
     * @param {object} fileInfo - Información del archivo
     * @returns {string} Contenido del archivo
     */
    generateFileContent(fileInfo) {
        // Obtener la plantilla para el tipo de archivo
        const template = this.fileTypes[fileInfo.type].template;

        // Reemplazar variables en la plantilla
        let content = template;
        for (const [key, value] of Object.entries(fileInfo)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        return content;
    }

    /**
     * Crea un archivo en el servidor
     * @param {string} fileName - Nombre del archivo
     * @param {string} content - Contenido del archivo
     * @returns {Promise} Promesa que se resuelve cuando se crea el archivo
     */
    async createFile(fileName, content) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Creando archivo: ${fileName}`);

                // Si tenemos fileActions disponible, usarlo
                if (this.fileActions && typeof this.fileActions.createFile === 'function') {
                    console.log('Usando fileActions.createFile');
                    const result = await this.fileActions.createFile(fileName, content);
                    resolve(result);
                } else {
                    // Caso contrario, usar el endpoint de procesamiento natural
                    console.log('Usando endpoint de procesamiento natural');
                    const response = await fetch('/api/process_natural', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: `Crea un archivo llamado ${fileName} con el siguiente contenido: ${content.substring(0, 100)}...`,
                            model: 'gemini',
                            user_id: 'default'
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error || 'Error al crear archivo'));
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Lee el contenido de un archivo
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<string>} Promesa que se resuelve con el contenido del archivo
     */
    async readFile(fileName) {
        return new Promise(async (resolve, reject) => {
            try {
                // Si tenemos fileActions disponible, usarlo
                if (this.fileActions && typeof this.fileActions.readFile === 'function') {
                    const result = await this.fileActions.readFile(fileName);
                    resolve(result.content);
                } else {
                    // Caso contrario, usar fetch directamente
                    const response = await fetch(`/api/file/read?file_path=${encodeURIComponent(fileName)}`);

                    const data = await response.json();

                    if (data.success) {
                        resolve(data.content);
                    } else {
                        reject(new Error(data.error || 'Error al leer archivo'));
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Guarda un archivo en el servidor
     * @param {string} fileName - Nombre del archivo
     * @param {string} content - Contenido del archivo
     * @returns {Promise} Promesa que se resuelve cuando se guarda el archivo
     */
    async saveFile(fileName, content) {
        return new Promise(async (resolve, reject) => {
            try {
                // Si tenemos fileActions disponible, usarlo
                if (this.fileActions && typeof this.fileActions.editFile === 'function') {
                    const result = await this.fileActions.editFile(fileName, content);
                    resolve(result);
                } else {
                    // Caso contrario, usar fetch directamente
                    const response = await fetch('/api/file/edit', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            file_path: fileName,
                            content: content
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error || 'Error al guardar archivo'));
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Ejecuta un comando en la terminal
     * @param {string} command - Comando a ejecutar
     * @returns {Promise} Promesa que se resuelve con el resultado del comando
     */
    async executeCommand(command) {
        return new Promise(async (resolve, reject) => {
            try {
                // Si tenemos terminalIntegration disponible, usarlo
                if (this.terminalIntegration && typeof this.terminalIntegration.executeCommand === 'function') {
                    const result = await this.terminalIntegration.executeCommand(command);
                    resolve(result);
                } else {
                    // Caso contrario, usar socket.io o fetch directamente
                    // Primero verificar si hay socket disponible
                    if (window.socket && typeof window.socket.emit === 'function') {
                        // Crear un listener temporal para la respuesta
                        const responseHandler = (data) => {
                            window.socket.off('command_result', responseHandler);
                            if (data.success) {
                                resolve(data);
                            } else {
                                reject(new Error(data.stderr || data.output || 'Error al ejecutar comando'));
                            }
                        };

                        // Registrar el listener
                        window.socket.on('command_result', responseHandler);

                        // Enviar el comando
                        window.socket.emit('bash_command', {
                            command: command,
                            user_id: 'default'
                        });

                        // Establecer un timeout por si no hay respuesta
                        setTimeout(() => {
                            window.socket.off('command_result', responseHandler);
                            reject(new Error('Timeout al ejecutar comando'));
                        }, 10000);
                    } else {
                        // Si no hay socket, usar fetch
                        const response = await fetch('/api/execute_command', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                command: command
                            })
                        });

                        const data = await response.json();

                        if (data.success) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || 'Error al ejecutar comando'));
                        }
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Extrae información de modificación a partir de una solicitud
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Información de modificación
     */
    extractModificationInfo(request) {
        // Valores predeterminados
        const modificationInfo = {
            fileName: null,
            type: 'append',  // append, replace, modify
            target: null,    // Sección o línea a modificar
            content: null,   // Nuevo contenido
            description: request
        };

        // Extraer nombre de archivo si se especifica
        const fileNameMatch = request.match(/(?:archivo|fichero|documento|página|componente)\s+(?:llamado|nombrado|con nombre|con el nombre)?\s+["']?([a-zA-Z0-9_\-\.]+)["']?/i);
        if (fileNameMatch && fileNameMatch[1]) {
            modificationInfo.fileName = fileNameMatch[1];
        }

        // Determinar tipo de modificación
        if (request.match(/reemplazar|sustituir|cambiar todo|sobrescribir/i)) {
            modificationInfo.type = 'replace';
        } else if (request.match(/modificar|cambiar|actualizar|editar/i)) {
            modificationInfo.type = 'modify';
        }

        // Extraer objetivo de la modificación
        const targetMatch = request.match(/(?:en|la|el)\s+(?:sección|parte|línea|elemento|componente|función|método)\s+["']?([^"']+)["']?/i);
        if (targetMatch && targetMatch[1]) {
            modificationInfo.target = targetMatch[1];
        }

        // Extraer contenido a añadir/reemplazar
        const contentMatch = request.match(/(?:con|por|a)\s+["']?([^"']+)["']?(?:\s+al final)?/i);
        if (contentMatch && contentMatch[1]) {
            modificationInfo.content = contentMatch[1];
        }

        // Extraer propiedades específicas para CSS
        if (request.match(/color|fondo|tamaño|fuente|margen|padding|borde/i)) {
            modificationInfo.cssProperties = this.extractCSSProperties(request);
        }

        return modificationInfo;
    }

    /**
     * Extrae propiedades CSS de una solicitud
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Propiedades CSS
     */
    extractCSSProperties(request) {
        const properties = {};

        // Color de fondo
        const bgColorMatch = request.match(/(?:color de fondo|background|fondo)\s+(?:a|en)?\s+["']?([a-zA-Z0-9#]+)["']?/i);
        if (bgColorMatch && bgColorMatch[1]) {
            properties['background-color'] = bgColorMatch[1];
        }

        // Color de texto
        const textColorMatch = request.match(/(?:color de texto|color)\s+(?:a|en)?\s+["']?([a-zA-Z0-9#]+)["']?/i);
        if (textColorMatch && textColorMatch[1]) {
            properties['color'] = textColorMatch[1];
        }

        // Tamaño de fuente
        const fontSizeMatch = request.match(/(?:tamaño de fuente|tamaño de letra|font-size)\s+(?:a|en)?\s+["']?([a-zA-Z0-9]+)["']?/i);
        if (fontSizeMatch && fontSizeMatch[1]) {
            properties['font-size'] = fontSizeMatch[1];
            // Añadir px si es un número
            if (/^\d+$/.test(properties['font-size'])) {
                properties['font-size'] += 'px';
            }
        }

        // Márgenes
        const marginMatch = request.match(/(?:margen|margin)\s+(?:a|en)?\s+["']?([a-zA-Z0-9]+)["']?/i);
        if (marginMatch && marginMatch[1]) {
            properties['margin'] = marginMatch[1];
            // Añadir px si es un número
            if (/^\d+$/.test(properties['margin'])) {
                properties['margin'] += 'px';
            }
        }

        return properties;
    }

    /**
     * Aplica modificaciones al contenido de un archivo
     * @param {string} currentContent - Contenido actual del archivo
     * @param {object} modificationInfo - Información de modificación
     * @returns {string} Nuevo contenido
     */
    applyModifications(currentContent, modificationInfo) {
        let newContent = currentContent;

        // Según el tipo de modificación
        switch (modificationInfo.type) {
            case 'replace':
                // Reemplazar todo el contenido
                newContent = modificationInfo.content || currentContent;
                break;

            case 'append':
                // Añadir al final
                newContent = currentContent + '\n' + (modificationInfo.content || '');
                break;

            case 'modify':
                // Modificar una sección específica
                if (modificationInfo.target && modificationInfo.content) {
                    // Si hay propiedades CSS, aplicarlas
                    if (modificationInfo.cssProperties) {
                        newContent = this.applyCSSModifications(currentContent, modificationInfo);
                    } else {
                        // Buscar la sección objetivo
                        const targetRegex = new RegExp(`(${modificationInfo.target}[^\\n]*\\n)([^\\n]*)`, 'i');
                        const match = currentContent.match(targetRegex);

                        if (match) {
                            // Reemplazar la sección
                            newContent = currentContent.replace(
                                targetRegex,
                                `$1${modificationInfo.content}`
                            );
                        } else {
                            // Si no se encuentra la sección, añadir al final
                            newContent = currentContent + '\n' + modificationInfo.content;
                        }
                    }
                }
                break;
        }

        return newContent;
    }

    /**
     * Aplica modificaciones CSS a un archivo
     * @param {string} currentContent - Contenido actual del archivo
     * @param {object} modificationInfo - Información de modificación
     * @returns {string} Nuevo contenido
     */
    applyCSSModifications(currentContent, modificationInfo) {
        let newContent = currentContent;

        // Si no hay propiedades CSS, devolver el contenido original
        if (!modificationInfo.cssProperties || Object.keys(modificationInfo.cssProperties).length === 0) {
            return newContent;
        }

        // Si hay un selector específico
        if (modificationInfo.target) {
            // Buscar el selector en el CSS
            const selectorRegex = new RegExp(`(${modificationInfo.target}[^{]*{)([^}]*)(})`, 'i');
            const match = currentContent.match(selectorRegex);

            if (match) {
                // Extraer las propiedades actuales
                let properties = match[2];

                // Añadir o reemplazar cada propiedad
                for (const [property, value] of Object.entries(modificationInfo.cssProperties)) {
                    const propertyRegex = new RegExp(`(\\s*${property}\\s*:)[^;]*(;)`, 'i');

                    if (propertyRegex.test(properties)) {
                        // Reemplazar propiedad existente
                        properties = properties.replace(propertyRegex, `$1 ${value}$2`);
                    } else {
                        // Añadir nueva propiedad
                        properties += `\n    ${property}: ${value};`;
                    }
                }

                // Reemplazar en el contenido
                newContent = currentContent.replace(selectorRegex, `$1${properties}$3`);
            } else {
                // Si no se encuentra el selector, añadirlo
                let newRule = `\n${modificationInfo.target} {\n`;

                // Añadir propiedades
                for (const [property, value] of Object.entries(modificationInfo.cssProperties)) {
                    newRule += `    ${property}: ${value};\n`;
                }

                newRule += '}\n';

                // Añadir al final
                newContent = currentContent + newRule;
            }
        } else {
            // Si no hay selector, buscar el body o añadir un selector genérico
            const bodyRegex = /body\s*{[^}]*}/i;
            const match = currentContent.match(bodyRegex);

            if (match) {
                // Modificar el body
                let bodyRule = match[0];

                // Añadir o reemplazar cada propiedad
                for (const [property, value] of Object.entries(modificationInfo.cssProperties)) {
                    const propertyRegex = new RegExp(`(\\s*${property}\\s*:)[^;]*(;)`, 'i');

                    if (propertyRegex.test(bodyRule)) {
                        // Reemplazar propiedad existente
                        bodyRule = bodyRule.replace(propertyRegex, `$1 ${value}$2`);
                    } else {
                        // Añadir nueva propiedad antes del cierre
                        bodyRule = bodyRule.replace(/}$/, `    ${property}: ${value};\n}`);
                    }
                }

                // Reemplazar en el contenido
                newContent = currentContent.replace(bodyRegex, bodyRule);
            } else {
                // Si no hay body, añadir un selector genérico
                let newRule = '\nbody {\n';

                // Añadir propiedades
                for (const [property, value] of Object.entries(modificationInfo.cssProperties)) {
                    newRule += `    ${property}: ${value};\n`;
                }

                newRule += '}\n';

                // Añadir al final
                newContent = currentContent + newRule;
            }
        }

        return newContent;
    }

    /**
     * Extrae información de comando a partir de una solicitud
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Información del comando
     */
    extractCommandInfo(request) {
        // Valores predeterminados
        const commandInfo = {
            command: '',
            description: request
        };

        // Intentar extraer un comando explícito
        const commandMatch = request.match(/(?:comando|ejecutar|correr)\s+["']?([^"']+)["']?/i);
        if (commandMatch && commandMatch[1]) {
            commandInfo.command = commandMatch[1];
            return commandInfo;
        }

        // Patrones comunes para comandos
        const commandPatterns = [
            { pattern: /instalar\s+(.+)/i, template: 'npm install $1' },
            { pattern: /iniciar\s+(?:el\s+)?servidor/i, template: 'npm start' },
            { pattern: /construir\s+(?:el\s+)?proyecto/i, template: 'npm run build' },
            { pattern: /ejecutar\s+pruebas/i, template: 'npm test' },
            { pattern: /inicializar\s+(?:un\s+)?proyecto/i, template: 'npm init -y' },
            { pattern: /clonar\s+(?:el\s+)?repositorio\s+(.+)/i, template: 'git clone $1' }
        ];

        // Verificar cada patrón
        for (const { pattern, template } of commandPatterns) {
            const match = request.match(pattern);
            if (match) {
                // Reemplazar variables en la plantilla
                let command = template;
                for (let i = 1; i < match.length; i++) {
                    command = command.replace(`$${i}`, match[i]);
                }

                commandInfo.command = command;
                return commandInfo;
            }
        }

        // Si no se pudo extraer un comando, enviar al servidor para procesamiento
        commandInfo.needsServerProcessing = true;

        return commandInfo;
    }

    /**
     * Extrae información de proyecto a partir de una solicitud
     * @param {string} request - Solicitud en lenguaje natural
     * @returns {object} Información del proyecto
     */
    extractProjectInfo(request) {
        // Valores predeterminados
        const projectInfo = {
            name: 'my-project',
            type: 'web',  // web, react, node, etc.
            description: request
        };

        // Extraer nombre del proyecto
        const nameMatch = request.match(/(?:proyecto|aplicación|app)\s+(?:llamado|nombrado|con nombre|con el nombre)?\s+["']?([a-zA-Z0-9_\-]+)["']?/i);
        if (nameMatch && nameMatch[1]) {
            projectInfo.name = nameMatch[1];
        }

        // Determinar tipo de proyecto
        if (request.match(/react|componente/i)) {
            projectInfo.type = 'react';
        } else if (request.match(/node|express|servidor/i)) {
            projectInfo.type = 'node';
        } else if (request.match(/html|css|web|página/i)) {
            projectInfo.type = 'web';
        }

        return projectInfo;
    }

    /**
     * Genera acciones para configurar un proyecto
     * @param {object} projectInfo - Información del proyecto
     * @returns {Array} Lista de acciones a realizar
     */
    generateProjectSetupActions(projectInfo) {
        const actions = [];

        // Según el tipo de proyecto
        switch (projectInfo.type) {
            case 'web':
                // Proyecto web básico
                actions.push({
                    type: 'createFile',
                    fileName: 'index.html',
                    content: this.generateFileContent({
                        type: 'html',
                        name: 'index.html',
                        title: projectInfo.name,
                        content: `Bienvenido a ${projectInfo.name}`
                    })
                });

                actions.push({
                    type: 'createFile',
                    fileName: 'styles.css',
                    content: this.generateFileContent({
                        type: 'css',
                        name: 'styles.css',
                        title: `Estilos para ${projectInfo.name}`
                    })
                });

                actions.push({
                    type: 'createFile',
                    fileName: 'script.js',
                    content: this.generateFileContent({
                        type: 'javascript',
                        name: 'script.js',
                        title: `Funcionalidad para ${projectInfo.name}`,
                        content: `Bienvenido a ${projectInfo.name}`
                    })
                });
                break;

            case 'react':
                // Proyecto React
                actions.push({
                    type: 'executeCommand',
                    command: `npx create-react-app ${projectInfo.name}`
                });
                break;

            case 'node':
                // Proyecto Node.js
                actions.push({
                    type: 'executeCommand',
                    command: `mkdir ${projectInfo.name} && cd ${projectInfo.name} && npm init -y`
                });

                actions.push({
                    type: 'createFile',
                    fileName: `${projectInfo.name}/index.js`,
                    content: `// Servidor para ${projectInfo.name}\nconst express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n    res.send('Bienvenido a ${projectInfo.name}');\n});\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => {\n    console.log(\`Servidor iniciado en puerto \${PORT}\`);\n});\n`
                });

                actions.push({
                    type: 'executeCommand',
                    command: `cd ${projectInfo.name} && npm install express`
                });
                break;
        }

        return actions;
    }
}

// Exportar la clase para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AugmentLikeProcessor;
} else {
    // Para uso en navegador
    window.AugmentLikeProcessor = AugmentLikeProcessor;
}
