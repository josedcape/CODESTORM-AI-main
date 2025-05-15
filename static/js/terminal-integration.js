document.addEventListener('DOMContentLoaded', function() {
    // Comprobar si NaturalCommandProcessor está disponible
    if (typeof NaturalCommandProcessor === 'undefined') {
        console.error('NaturalCommandProcessor no está disponible. Asegúrate de que natural-command-processor.js esté cargado correctamente.');
        return;
    }

    // Inicializar componentes
    const terminalContainer = document.getElementById('terminal-container');
    const commandInput = document.getElementById('command-input');
    const executeButton = document.getElementById('execute-button');
    const clearButton = document.getElementById('clear-button');
    const outputDisplay = document.getElementById('output-display');
    const commandDisplay = document.getElementById('command-display');
    const fileExplorer = document.getElementById('file-explorer');
    const directoryPath = document.getElementById('directory-path');
    const statusIndicator = document.getElementById('status-indicator');

    // Inicializar el procesador de comandos naturales 
    const naturalCommandProcessor = new NaturalCommandProcessor();

    // Historial de comandos
    let commandHistory = [];
    let historyIndex = -1;
    let currentDirectory = '.';

    // Socket para comunicación en tiempo real
    let socket;

    // Inicializar asistente de comandos si existe
    if (window.commandAssistant && typeof window.commandAssistant.init === 'function') {
        window.commandAssistant.init();
    }

    // Inicializar WebSocket si está disponible
    function initializeSocket() {
        try {
            // Intentar con socket.io primero
            if (typeof io !== 'undefined') {
                socket = io();

                socket.on('connect', function() {
                    updateStatusIndicator(true);
                    console.log('WebSocket conectado');
                });

                socket.on('disconnect', function() {
                    updateStatusIndicator(false);
                    console.log('WebSocket desconectado');
                });

                socket.on('file_update', function(data) {
                    console.log('Actualización de archivo recibida:', data);
                    // Recargar explorador de archivos
                    loadFiles(currentDirectory);

                    // Mostrar notificación
                    showNotification(`Archivo actualizado: ${data.path}`, 'info');
                });

                socket.on('command_output', function(data) {
                    console.log('Salida de comando recibida:', data);
                    displayCommandOutput(data.command, data.output, data.error, data.exitCode);
                });
            } else {
                console.warn('Socket.io no está disponible');
                // Intentar con WebSocket nativo como alternativa
                initializeNativeWebSocket();
            }
        } catch (error) {
            console.error('Error al inicializar WebSocket:', error);
            updateStatusIndicator(false);
        }
    }

    // Inicializar WebSocket nativo como alternativa
    function initializeNativeWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;

            const ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                updateStatusIndicator(true);
                console.log('WebSocket nativo conectado');
            };

            ws.onclose = function() {
                updateStatusIndicator(false);
                console.log('WebSocket nativo desconectado');
                // Intentar reconectar después de 5 segundos
                setTimeout(initializeNativeWebSocket, 5000);
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'file_update') {
                        console.log('Actualización de archivo recibida:', data);
                        // Recargar explorador de archivos
                        loadFiles(currentDirectory);

                        // Mostrar notificación
                        showNotification(`Archivo actualizado: ${data.path}`, 'info');
                    } else if (data.type === 'command_output') {
                        console.log('Salida de comando recibida:', data);
                        displayCommandOutput(data.command, data.output, data.error, data.exitCode);
                    }
                } catch (error) {
                    console.error('Error al procesar mensaje WebSocket:', error);
                }
            };

            ws.onerror = function(error) {
                console.error('Error de WebSocket:', error);
                updateStatusIndicator(false);
            };

            // Guardar referencia global
            window.nativeWebSocket = ws;
        } catch (error) {
            console.error('Error al inicializar WebSocket nativo:', error);
            updateStatusIndicator(false);
        }
    }

    // Actualizar indicador de estado
    function updateStatusIndicator(connected) {
        if (statusIndicator) {
            statusIndicator.className = connected ?
                'status-indicator status-connected' :
                'status-indicator status-disconnected';

            // Actualizar tooltip
            statusIndicator.title = connected ?
                'Servidor conectado' :
                'Servidor desconectado';
        }
    }

    // Cargar archivos en el explorador
    function loadFiles(directory) {
        currentDirectory = directory;

        // Intentar primero con la ruta /files
        fetch(`/files?directory=${encodeURIComponent(directory)}`)
            .then(response => {
                if (!response.ok) {
                    // Si falla, intentar con la ruta alternativa
                    if (response.status === 404) {
                        return fetch(`/api/files?path=${encodeURIComponent(directory)}`);
                    }
                    throw new Error(`Error al cargar archivos: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Manejar diferentes formatos de respuesta
                const files = data.files || data.items || [];
                const dir = data.directory || data.current_path || directory;

                if (Array.isArray(files)) {
                    displayFiles(files, dir);
                    if (directoryPath) {
                        directoryPath.textContent = dir === '.' ? '/' : dir;
                    }
                } else {
                    throw new Error('Formato de respuesta no reconocido');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification(error.message, 'danger');

                // Si hay error, intentar cargar el directorio raíz
                if (directory !== '.') {
                    setTimeout(() => loadFiles('.'), 500);
                }
            });
    }

    // Mostrar archivos en el explorador
    function displayFiles(files, directory) {
        if (!fileExplorer) return;

        fileExplorer.innerHTML = '';

        // Si no estamos en el directorio raíz, agregar opción para subir
        if (directory !== '.') {
            const parentDir = directory.split('/').slice(0, -1).join('/') || '.';
            const upDirectory = document.createElement('div');
            upDirectory.className = 'p-2 border-bottom d-flex align-items-center';
            upDirectory.innerHTML = `
                <i class="bi bi-arrow-up-circle me-2 text-info"></i>
                <span>..</span>
            `;
            upDirectory.style.cursor = 'pointer';
            upDirectory.addEventListener('click', () => loadFiles(parentDir));
            fileExplorer.appendChild(upDirectory);
        }

        // Ordenar: directorios primero, luego archivos
        const directories = files.filter(f => f.type === 'directory');
        const regularFiles = files.filter(f => f.type === 'file');

        // Agregar directorios
        directories.forEach(dir => {
            const dirElement = document.createElement('div');
            dirElement.className = 'p-2 border-bottom d-flex align-items-center directory file-item';
            dirElement.dataset.path = dir.path;
            dirElement.dataset.name = dir.name;
            dirElement.dataset.type = 'directory';

            dirElement.innerHTML = `
                <div class="d-flex align-items-center flex-grow-1">
                    <i class="bi bi-folder-fill me-2 text-warning"></i>
                    <span>${dir.name}</span>
                </div>
                <div class="file-actions">
                    <button class="btn btn-sm btn-outline-secondary btn-edit-name" title="Renombrar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            dirElement.style.cursor = 'pointer';

            // Solo el área de texto navega al directorio, no los botones
            const textArea = dirElement.querySelector('div:first-child');
            textArea.addEventListener('click', () => loadFiles(dir.path));

            // Agregar evento de clic derecho para menú contextual
            dirElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.fileActions && typeof window.fileActions.showContextMenu === 'function') {
                    window.fileActions.showContextMenu(e, dir.path, true);
                }
                return false;
            });

            // Configurar botones de acción
            setupActionButtons(dirElement, dir);

            fileExplorer.appendChild(dirElement);
        });

        // Agregar archivos
        regularFiles.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = 'p-2 border-bottom d-flex align-items-center justify-content-between file file-item';
            fileElement.dataset.path = file.path;
            fileElement.dataset.name = file.name;
            fileElement.dataset.type = 'file';

            // Determinar icono según extensión
            let icon = 'bi-file-earmark';
            const ext = file.name.split('.').pop().toLowerCase();

            if (['html', 'htm'].includes(ext)) icon = 'bi-file-earmark-code';
            else if (['js', 'ts'].includes(ext)) icon = 'bi-filetype-js';
            else if (['css', 'scss'].includes(ext)) icon = 'bi-filetype-css';
            else if (['py'].includes(ext)) icon = 'bi-filetype-py';
            else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) icon = 'bi-file-earmark-image';
            else if (['md'].includes(ext)) icon = 'bi-file-earmark-text';

            fileElement.innerHTML = `
                <div class="d-flex align-items-center flex-grow-1">
                    <i class="bi ${icon} me-2 text-muted"></i>
                    <span>${file.name}</span>
                </div>
                <div class="d-flex align-items-center">
                    <span class="text-muted small me-2">${formatFileSize(file.size || 0)}</span>
                    <div class="file-actions">
                        <button class="btn btn-sm btn-outline-secondary btn-edit" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-edit-name" title="Renombrar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            // Configurar botones de acción
            setupActionButtons(fileElement, file);

            // Clic derecho para menú contextual
            fileElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.fileActions && typeof window.fileActions.showContextMenu === 'function') {
                    window.fileActions.showContextMenu(e, file.path, false);
                }
                return false;
            });

            fileExplorer.appendChild(fileElement);
        });

        // Mostrar mensaje si no hay archivos
        if (files.length === 0) {
            fileExplorer.innerHTML = '<div class="p-3 text-center text-muted">No hay archivos en este directorio</div>';
        }

        // Mejorar display de archivos si está disponible
        if (window.fileActions && typeof window.fileActions.enhanceFileDisplay === 'function') {
            setTimeout(window.fileActions.enhanceFileDisplay, 100);
        }

        // Añadir estilos CSS para los botones de acción si no existen
        if (!document.getElementById('file-actions-styles')) {
            const style = document.createElement('style');
            style.id = 'file-actions-styles';
            style.textContent = `
                .file-item {
                    position: relative;
                }
                .file-actions {
                    display: none;
                    gap: 5px;
                }
                .file-item:hover .file-actions {
                    display: flex;
                }
                .file-actions button {
                    padding: 0.15rem 0.4rem;
                    font-size: 0.75rem;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Configurar botones de acción para archivos y carpetas
    function setupActionButtons(element, fileData) {
        // Botón Editar
        const editBtn = element.querySelector('.btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = `/edit_file?path=${encodeURIComponent(fileData.path)}`;
            });
        }

        // Botón Renombrar
        const renameBtn = element.querySelector('.btn-edit-name');
        if (renameBtn) {
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renameFileOrFolder(fileData.path, fileData.name);
            });
        }

        // Botón Eliminar
        const deleteBtn = element.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFileOrFolder(fileData.path, fileData.name);
            });
        }
    }

    // Renombrar archivo o carpeta
    function renameFileOrFolder(path, currentName) {
        const newName = prompt('Ingrese el nuevo nombre:', currentName);
        if (!newName || newName === currentName) return;

        // Llamar al endpoint de renombrar
        fetch('/api/file/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_path: path,
                new_name: newName
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showNotification(`Elemento renombrado correctamente a "${newName}"`, 'success');
                // Recargar archivos
                loadFiles(currentDirectory);
            } else {
                showNotification(data.error || 'Error al renombrar elemento', 'danger');
            }
        })
        .catch(error => {
            console.error('Error al renombrar:', error);
            showNotification(error.message, 'danger');
        });
    }

    // Eliminar archivo o carpeta
    function deleteFileOrFolder(path, name) {
        if (!confirm(`¿Está seguro de que desea eliminar "${name}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        // Llamar al endpoint de eliminar
        fetch('/api/file/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_path: path
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showNotification(`Elemento "${name}" eliminado correctamente`, 'success');
                // Recargar archivos
                loadFiles(currentDirectory);
            } else {
                showNotification(data.error || 'Error al eliminar elemento', 'danger');
            }
        })
        .catch(error => {
            console.error('Error al eliminar:', error);
            showNotification(error.message, 'danger');
        });
    }

    // Formatear tamaño de archivo
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Instalar dependencia/paquete
    function installPackage(packageName, packageManager = 'pip') {
        if (!packageName) return;

        // Mostrar indicador de carga
        if (outputDisplay) {
            outputDisplay.innerHTML = `<div class="spinner-border spinner-border-sm text-light" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div> Instalando paquete ${packageName}...`;
        }

        // Enviar solicitud para instalar el paquete
        fetch('/api/package/install', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                package: packageName,
                manager: packageManager
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al instalar paquete: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Mostrar resultado en la interfaz
                if (outputDisplay) {
                    outputDisplay.innerHTML = `
                        <div class="mb-2"><span class="text-success">✓</span> Paquete ${packageName} instalado correctamente</div>
                        <pre class="mb-2 text-light">${data.stdout}</pre>
                        ${data.stderr ? `<pre class="mb-2 text-warning">${data.stderr}</pre>` : ''}
                    `;
                }
                showNotification(`Paquete ${packageName} instalado correctamente`, 'success');
            } else {
                // Mostrar error en la interfaz
                if (outputDisplay) {
                    outputDisplay.innerHTML = `
                        <div class="mb-2"><span class="text-danger">✗</span> Error al instalar paquete ${packageName}</div>
                        <pre class="mb-2 text-danger">${data.stderr || data.error}</pre>
                        ${data.stdout ? `<pre class="mb-2 text-light">${data.stdout}</pre>` : ''}
                    `;
                }
                showNotification(`Error al instalar paquete: ${data.error || 'Error desconocido'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (outputDisplay) {
                outputDisplay.innerHTML = `<div class="text-danger">Error: ${error.message}</div>`;
            }
            showNotification(error.message, 'danger');
        });
    }

    // Ejecutar comando
    function executeCommand(command, showInDisplay = true) {
        if (!command) return;

        // Verificar si es un comando de instalación de paquete
        const pipInstallRegex = /^pip\s+install\s+(.+)$/i;
        const npmInstallRegex = /^npm\s+(?:install|i)\s+(.+)$/i;
        const yarnAddRegex = /^yarn\s+add\s+(.+)$/i;

        const pipMatch = command.match(pipInstallRegex);
        const npmMatch = command.match(npmInstallRegex);
        const yarnMatch = command.match(yarnAddRegex);

        if (pipMatch) {
            installPackage(pipMatch[1], 'pip');
            return;
        } else if (npmMatch) {
            installPackage(npmMatch[1], 'npm');
            return;
        } else if (yarnMatch) {
            installPackage(yarnMatch[1], 'yarn');
            return;
        }

        // Mostrar comando en la interfaz
        if (showInDisplay && commandDisplay) {
            commandDisplay.textContent = command;
        }

        // Agregar al historial
        if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command) {
            commandHistory.push(command);
            historyIndex = commandHistory.length;
        }

        // Mostrar indicador de carga
        if (outputDisplay) {
            outputDisplay.innerHTML = '<div class="spinner-border spinner-border-sm text-light" role="status"><span class="visually-hidden">Cargando...</span></div> Ejecutando comando...';
        }

        // Ejecutar comando en el servidor
        fetch('/execute_command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                directory: currentDirectory
            })
        })
        .then(response => {
            if (!response.ok) {
                // Intentar con ruta alternativa si la primera falla
                if (response.status === 404) {
                    return fetch('/api/execute', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            command: command,
                            directory: currentDirectory
                        })
                    });
                }
                throw new Error(`Error al ejecutar comando: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Procesar la respuesta
            const output = data.output || '';
            const error = data.error || '';
            const exitCode = data.exit_code || 0;

            // Mostrar resultado en la interfaz
            displayCommandOutput(command, output, error, exitCode);

            // Lista ampliada de comandos que modifican archivos
            const fileModifyingCommands = [
                'mkdir', 'touch', 'rm', 'mv', 'cp', 'echo', 'cat', 
                'npm init', 'git init', 'nano', 'vim', 'vi', 
                'wget', 'curl', 'unzip', 'tar', 'npm install',
                'pip install', 'python -m pip', 'npm i', 'yarn add'
            ];

            // Si es un comando que podría cambiar archivos, actualizar explorador
            const shouldRefresh = fileModifyingCommands.some(cmd => command.includes(cmd));
            if (shouldRefresh) {
                // Notificar al sistema que los archivos cambiaron
                console.log("Detectado cambio en explorador");

                // Actualizar con múltiples métodos para mayor compatibilidad
                setTimeout(() => {
                    // Método 1: Usando loadFiles
                    loadFiles(currentDirectory);

                    // Método 2: Usando refreshFileExplorer global
                    if (window.refreshFileExplorer && typeof window.refreshFileExplorer === 'function') {
                        window.refreshFileExplorer();
                    }

                    // Método 3: Emitir evento para que otros componentes respondan
                    document.dispatchEvent(new CustomEvent('files_updated', {
                        detail: { directory: currentDirectory }
                    }));
                }, 500);
            }

            // Si es un comando cd, actualizar directorio actual
            if (command.trim().startsWith('cd ')) {
                const newDir = command.trim().substring(3).trim();
                if (newDir) {
                    // Calcular nueva ruta
                    let targetDir;
                    if (newDir.startsWith('/')) {
                        targetDir = newDir;
                    } else if (newDir === '..') {
                        targetDir = currentDirectory.split('/').slice(0, -1).join('/') || '.';
                    } else {
                        targetDir = currentDirectory === '.' ? newDir : `${currentDirectory}/${newDir}`;
                    }

                    // Actualizar directorio y cargar archivos
                    currentDirectory = targetDir;
                    loadFiles(targetDir);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (outputDisplay) {
                outputDisplay.innerHTML = `<div class="text-danger">Error: ${error.message}</div>`;
            }
            showNotification(error.message, 'danger');
        });
    }

    // Mostrar resultado de comando en la interfaz
    function displayCommandOutput(command, output, error, exitCode) {
        if (!outputDisplay) return;

        let outputHtml = '';

        // Agregar comando ejecutado
        outputHtml += `<div class="mb-2"><span class="text-primary">$</span> <span class="text-light">${escapeHtml(command)}</span></div>`;

        // Agregar salida si existe
        if (output) {
            outputHtml += `<pre class="mb-2 text-light">${escapeHtml(output)}</pre>`;
        }

        // Agregar error si existe
        if (error) {
            outputHtml += `<pre class="mb-2 text-danger">${escapeHtml(error)}</pre>`;
        }

        // Agregar código de salida si no es 0
        if (exitCode !== 0) {
            outputHtml += `<div class="text-warning">Código de salida: ${exitCode}</div>`;
        }

        outputDisplay.innerHTML = outputHtml;

        // Desplazar hacia abajo para mostrar el resultado más reciente
        outputDisplay.scrollTop = outputDisplay.scrollHeight;
    }

    // Escapar HTML para evitar inyección de código
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Mostrar notificación
    function showNotification(message, type = 'info') {
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        notificationContainer.appendChild(notification);

        // Eliminar notificación después de 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Procesar instrucción en lenguaje natural
    function processNaturalLanguage(instruction) {
        try {
            // Procesar la instrucción
            const result = naturalCommandProcessor.processInstruction(instruction, currentDirectory);

            // Ejecutar comando
            if (result.command) {
                executeCommand(result.command);

                // Mostrar notificación más específica según el tipo de operación
                if (result.type === 'file_create' || result.type === 'directory_create') {
                    showNotification(`Se ha creado un nuevo elemento: ${result.fileName || result.dirName || 'elemento'}`, 'success');
                } else if (result.type === 'file_delete' || result.type === 'directory_delete') {
                    showNotification(`Se ha eliminado: ${result.fileName || result.dirName || 'elemento'}`, 'warning');
                } else {
                    showNotification(`Instrucción procesada: ${result.description}`, 'success');
                }

                return true;
            } else {
                // Si no se pudo procesar, intentar enviar al asistente
                sendToAssistant(instruction);
                return false;
            }
        } catch (error) {
            console.error('Error al procesar instrucción:', error);
            showNotification(`Error al procesar instrucción: ${error.message}`, 'danger');
            return false;
        }
    }

    // Enviar instrucción al asistente
    function sendToAssistant(instruction) {
        // Verificar si existe un iframe del asistente
        const assistantFrame = document.getElementById('assistant-frame');
        if (assistantFrame) {
            // Enviar mensaje al iframe
            assistantFrame.contentWindow.postMessage({
                type: 'instruction',
                instruction: instruction
            }, '*');

            showNotification('Instrucción enviada al asistente', 'info');
            return true;
        } else {
            return new Promise((resolve, reject) => {
                fetch('/api/process_instructions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        instruction: instruction,
                        directory: currentDirectory,
                        model: 'openai'
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error al comunicarse con el asistente: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.command) {
                        // Ejecutar comando generado por el asistente
                        executeCommand(data.command);
                        showNotification('Comando generado por el asistente', 'success');
                        resolve(true);
                    } else if (data.message) {
                        // Mostrar respuesta del asistente
                        showNotification(`Asistente: ${data.message}`, 'info');
                        resolve(true);
                    } else {
                        showNotification('El asistente no pudo procesar la instrucción', 'warning');
                        resolve(false);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showNotification(`Error: ${error.message}`, 'error');
                    reject(error);
                });
            });
        }
    }

    // Configurar eventos
    if (commandInput && executeButton) {
        // Ejecutar comando al hacer clic en el botón
        executeButton.addEventListener('click', () => {
            const command = commandInput.value.trim();
            if (command) {
                // Verificar si es una instrucción en lenguaje natural
                if (command.startsWith('!')) {
                    // Eliminar el prefijo ! y procesar como lenguaje natural
                    processNaturalLanguage(command.substring(1).trim());
                } else {
                    // Ejecutar como comando directo
                    executeCommand(command);
                }
                commandInput.value = '';
            }
        });

        // Ejecutar comando al presionar Enter
        commandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const command = commandInput.value.trim();
                if (command) {
                    // Verificar si es una instrucción en lenguaje natural
                    if (command.startsWith('!')) {
                        // Eliminar el prefijo ! y procesar como lenguaje natural
                        processNaturalLanguage(command.substring(1).trim());
                    } else {
                        // Ejecutar como comando directo
                        executeCommand(command);
                    }
                    commandInput.value = '';
                }
            } else if (event.key === 'ArrowUp') {
                // Navegar hacia atrás en el historial
                if (historyIndex > 0) {
                    historyIndex--;
                    commandInput.value = commandHistory[historyIndex];
                }
                event.preventDefault();
            } else if (event.key === 'ArrowDown') {
                // Navegar hacia adelante en el historial
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    commandInput.value = commandHistory[historyIndex];
                } else if (historyIndex === commandHistory.length - 1) {
                    historyIndex = commandHistory.length;
                    commandInput.value = '';
                }
                event.preventDefault();
            }
        });
    }

    // Limpiar terminal
    if (clearButton && outputDisplay) {
        clearButton.addEventListener('click', () => {
            outputDisplay.innerHTML = '';
        });
    }

    // Escuchar mensajes del asistente
    window.addEventListener('message', function(event) {
        // Verificar origen del mensaje por seguridad
        // if (event.origin !== window.location.origin) return;

        const data = event.data;

        if (data && data.type === 'command') {
            // Ejecutar comando enviado por el asistente
            executeCommand(data.command);
        } else if (data && data.type === 'instruction') {
            // Procesar instrucción en lenguaje natural
            processNaturalLanguage(data.instruction);
        }
    });

    // Exponer funciones para uso externo
    window.terminalInterface = {
        executeCommand,
        processNaturalLanguage,
        loadFiles,
        getCurrentDirectory: () => currentDirectory,
        installPackage: (packageName, packageManager = 'pip') => {
            installPackage(packageName, packageManager);
        },
        deleteFile: (filePath) => {
            if (window.fileActions && typeof window.fileActions.deleteFileOrFolder === 'function') {
                window.fileActions.deleteFileOrFolder(filePath);
            } else {
                const command = `rm -rf ${filePath}`;
                executeCommand(command);
            }
        },
        editFile: (filePath, content) => {
            if (window.fileActions && typeof window.fileActions.editFile === 'function') {
                window.fileActions.editFile(filePath, content);
            } else {
                showNotification('Funcionalidad de edición no disponible', 'warning');
            }
        }
    };

    // Inicializar
    initializeSocket();
    loadFiles(currentDirectory);
});

function formatUptime(seconds) {
    let days = Math.floor(seconds / (3600 * 24));
    let hours = Math.floor((seconds % (3600 * 24)) / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    seconds = Math.floor(seconds % 60);

    let uptime = '';
    if (days > 0) uptime += `${days}d `;
    if (hours > 0 || days > 0) uptime += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptime += `${minutes}m `;
    uptime += `${seconds}s`;

    return uptime;
}

// Exponer funciones para uso externo
window.webSocketClient = {
    sendMessage: function(type, data) {
        if (socket && socket.connected) {
            socket.emit(type, data);
            return true;
        } else if (window.nativeWebSocket && window.nativeWebSocket.readyState === WebSocket.OPEN) {
            window.nativeWebSocket.send(JSON.stringify({
                type: type,
                data: data
            }));
            return true;
        }
        return false;
    }
}

function processInput() {
    const inputElement = document.getElementById('terminal-input');
    const input = inputElement.value.trim();

    if (!input) return;

    // Escribir el comando en la terminal
    writeToTerminal('\r\n$ ' + input + '\r\n');

    // Si comienza con !, es un comando directo
    if (input.startsWith('!')) {
        const directCommand = input.substring(1).trim();
        executeCommand(directCommand);
        return;
    }

    // Enviar al asistente directamente
    sendToAssistant(input);
}

function executeCommand(command) {
    if (!command) return;

    if (!connected) {
        writeToTerminal('\r\n\x1b[31mError: No hay conexión con el servidor\x1b[0m\r\n');
        writeToTerminal('\r\n$ ');
        return;
    }

    // Enviar comando al servidor
    socket.emit('execute_command', {
        command: command,
        user_id: userId,
        terminal_id: terminalId
    });

    // Limpiar la entrada después de enviar
    document.getElementById('terminal-input').value = '';
}