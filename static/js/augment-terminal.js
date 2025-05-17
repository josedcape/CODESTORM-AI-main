/**
 * CODESTORM - Terminal Integration with File Explorer
 * Terminal con capacidades de procesamiento de comandos y exploración de archivos
 */

class AugmentTerminal {
    constructor(options = {}) {
        this.options = {
            containerId: 'terminal-container',
            outputId: 'terminal-output',
            inputId: 'terminal-input',
            explorerContainerId: 'file-explorer-container',
            promptText: '$ ',
            maxLines: 1000,
            currentDirectory: '~',
            ...options
        };
        
        // Elementos DOM principales
        this.container = document.getElementById(this.options.containerId);
        this.output = document.getElementById(this.options.outputId);
        this.input = document.getElementById(this.options.inputId);
        this.explorerContainer = document.getElementById(this.options.explorerContainerId);
        
        // Estado de la terminal
        this.history = [];
        this.historyIndex = -1;
        this.commandQueue = [];
        this.currentDirectory = this.options.currentDirectory;
        this.fileSystem = options.fileSystem || {};
        
        // Conexión socket
        this.socket = options.socket || null;
        
        // Inicializar componentes
        if (this.container) {
            this.initialize();
        }
        
        if (this.explorerContainer) {
            this.initializeFileExplorer();
        }
    }
    
    /**
     * Inicializa la terminal
     */
    initialize() {
        // Crear elemento de salida si no existe
        if (!this.output) {
            this.output = document.createElement('div');
            this.output.id = this.options.outputId;
            this.output.className = 'terminal-output';
            this.container.appendChild(this.output);
        }
        
        // Crear elemento de entrada si no existe
        if (!this.input) {
            this.input = document.createElement('div');
            this.input.id = this.options.inputId;
            this.input.className = 'terminal-input-wrapper';
            
            const promptSpan = document.createElement('span');
            promptSpan.className = 'terminal-prompt';
            promptSpan.textContent = this.options.promptText;
            
            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.className = 'terminal-input-field';
            inputField.setAttribute('autocomplete', 'off');
            inputField.setAttribute('spellcheck', 'false');
            
            this.input.appendChild(promptSpan);
            this.input.appendChild(inputField);
            this.container.appendChild(this.input);
            
            // Configurar eventos de entrada
            this.setupInputEvents(inputField);
        }
        
        // Mensaje de bienvenida
        this.appendOutput('Terminal inicializada. Escribe comandos o usa lenguaje natural.', 'info');
        this.appendOutput(`Directorio actual: ${this.currentDirectory}`, 'info');
        this.appendOutput('', 'text');
    }
    
    /**
     * Configura eventos para el campo de entrada
     */
    setupInputEvents(inputField) {
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = inputField.value.trim();
                inputField.value = '';
                
                if (command) {
                    if (command.startsWith('!')) {
                        // Procesar como lenguaje natural
                        this.processNaturalLanguage(command.substring(1));
                    } else {
                        // Ejecutar como comando
                        this.executeCommand(command);
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1, inputField);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1, inputField);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.autoComplete(inputField);
            }
        });
    }
    
    /**
     * Navega por el historial de comandos
     */
    navigateHistory(direction, inputField) {
        if (this.history.length === 0) return;
        
        this.historyIndex += direction;
        
        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
        }
        
        inputField.value = this.history[this.historyIndex];
    }
    
    /**
     * Implementa autocompletado básico
     */
    autoComplete(inputField) {
        const command = inputField.value;
        // Aquí se implementaría la lógica de autocompletado
        // Por ejemplo, obtener archivos del directorio actual que coincidan
        
        // Simulación simple de autocompletado
        if (command.startsWith('cd ')) {
            const partial = command.substring(3);
            const possibleDirs = this.getDirectoriesStartingWith(partial);
            
            if (possibleDirs.length === 1) {
                inputField.value = `cd ${possibleDirs[0]}`;
            } else if (possibleDirs.length > 1) {
                this.appendOutput('Posibles directorios:', 'info');
                possibleDirs.forEach(dir => this.appendOutput(dir, 'text'));
            }
        }
    }
    
    /**
     * Inicializa el explorador de archivos
     */
    initializeFileExplorer() {
        if (!this.explorerContainer) return;
        
        // Limpiar contenedor
        this.explorerContainer.innerHTML = '';
        
        // Crear cabecera
        const header = document.createElement('div');
        header.className = 'file-explorer-header';
        header.innerHTML = `
            <h3>Explorador de Archivos</h3>
            <div class="file-explorer-path">${this.currentDirectory}</div>
            <div class="file-explorer-actions">
                <button class="refresh-btn">Refrescar</button>
                <button class="new-file-btn">Nuevo Archivo</button>
                <button class="new-folder-btn">Nueva Carpeta</button>
            </div>
        `;
        this.explorerContainer.appendChild(header);
        
        // Contenedor de archivos
        const filesContainer = document.createElement('div');
        filesContainer.className = 'file-explorer-files';
        this.explorerContainer.appendChild(filesContainer);
        
        // Configurar eventos
        header.querySelector('.refresh-btn').addEventListener('click', () => this.refreshFileExplorer());
        header.querySelector('.new-file-btn').addEventListener('click', () => this.createNewFile());
        header.querySelector('.new-folder-btn').addEventListener('click', () => this.createNewFolder());
        
        // Cargar archivos iniciales
        this.loadFilesForExplorer();
    }
    
    /**
     * Carga los archivos para el explorador
     */
    loadFilesForExplorer() {
        // Obtener archivos del directorio actual
        this.getFilesInCurrentDirectory()
            .then(files => {
                const filesContainer = this.explorerContainer.querySelector('.file-explorer-files');
                filesContainer.innerHTML = '';
                
                // Agregar opción para subir un nivel
                if (this.currentDirectory !== '~') {
                    const upDir = document.createElement('div');
                    upDir.className = 'file-item directory';
                    upDir.innerHTML = '<i class="fa fa-level-up"></i> ..';
                    upDir.addEventListener('click', () => this.navigateToParentDirectory());
                    filesContainer.appendChild(upDir);
                }
                
                // Mostrar directorios primero
                files.filter(f => f.type === 'directory')
                    .forEach(dir => {
                        const dirElement = document.createElement('div');
                        dirElement.className = 'file-item directory';
                        dirElement.innerHTML = `<i class="fa fa-folder"></i> ${dir.name}`;
                        dirElement.addEventListener('click', () => this.navigateToDirectory(dir.name));
                        filesContainer.appendChild(dirElement);
                    });
                
                // Luego mostrar archivos
                files.filter(f => f.type === 'file')
                    .forEach(file => {
                        const fileElement = document.createElement('div');
                        fileElement.className = 'file-item file';
                        fileElement.innerHTML = `<i class="fa fa-file"></i> ${file.name}`;
                        fileElement.addEventListener('click', () => this.openFile(file.name));
                        
                        // Menú contextual
                        fileElement.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            this.showFileContextMenu(e, file);
                        });
                        
                        filesContainer.appendChild(fileElement);
                    });
            })
            .catch(error => {
                console.error('Error cargando archivos:', error);
                this.appendOutput(`Error cargando archivos: ${error.message}`, 'error');
            });
    }
    
    /**
     * Obtiene archivos en el directorio actual
     */
    getFilesInCurrentDirectory() {
        // Si hay socket, usar para obtener archivos
        if (this.socket && this.socket.isConnected) {
            return this.socket.getFiles(this.currentDirectory);
        }
        
        // Fallback a fetch API
        return fetch(`/api/files?path=${encodeURIComponent(this.currentDirectory)}`)
            .then(response => response.json())
            .then(data => data.files || [])
            .catch(error => {
                console.error('Error fetching files:', error);
                return [];
            });
    }
    
    /**
     * Navega a un directorio
     */
    navigateToDirectory(dirName) {
        const newPath = this.currentDirectory === '~' 
            ? `~/${dirName}` 
            : `${this.currentDirectory}/${dirName}`;
            
        this.currentDirectory = newPath;
        this.refreshFileExplorer();
        this.appendOutput(`Cambiando a directorio: ${newPath}`, 'info');
        
        // Ejecutar comando cd en la terminal para mantener sincronización
        this.executeCommand(`cd ${dirName}`, false);
    }
    
    /**
     * Navega al directorio padre
     */
    navigateToParentDirectory() {
        if (this.currentDirectory === '~') return;
        
        const parts = this.currentDirectory.split('/');
        parts.pop();
        this.currentDirectory = parts.join('/') || '~';
        
        this.refreshFileExplorer();
        this.appendOutput(`Cambiando a directorio: ${this.currentDirectory}`, 'info');
        
        // Ejecutar comando cd .. en la terminal
        this.executeCommand('cd ..', false);
    }
    
    /**
     * Abre un archivo
     */
    openFile(fileName) {
        const filePath = this.currentDirectory === '~' 
            ? `~/${fileName}` 
            : `${this.currentDirectory}/${fileName}`;
            
        this.appendOutput(`Abriendo archivo: ${filePath}`, 'info');
        
        // Aquí iría la lógica para abrir el archivo en un editor
        // Por ejemplo, emitir un evento para que otro componente lo maneje
        const event = new CustomEvent('file-open', { 
            detail: { 
                path: filePath, 
                name: fileName 
            } 
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Muestra menú contextual para un archivo
     */
    showFileContextMenu(event, file) {
        // Eliminar menú existente si hay alguno
        const existingMenu = document.querySelector('.file-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Crear menú contextual
        const menu = document.createElement('div');
        menu.className = 'file-context-menu';
        menu.style.position = 'absolute';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        // Opciones del menú
        const options = [
            { label: 'Abrir', action: () => this.openFile(file.name) },
            { label: 'Renombrar', action: () => this.renameFile(file.name) },
            { label: 'Eliminar', action: () => this.deleteFile(file.name) },
            { label: 'Copiar ruta', action: () => this.copyFilePath(file.name) }
        ];
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'menu-item';
            item.textContent = option.label;
            item.addEventListener('click', () => {
                option.action();
                menu.remove();
            });
            menu.appendChild(item);
        });
        
        // Agregar al DOM
        document.body.appendChild(menu);
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }
    
    /**
     * Refresca el explorador de archivos
     */
    refreshFileExplorer() {
        // Actualizar ruta en la UI
        const pathElement = this.explorerContainer.querySelector('.file-explorer-path');
        if (pathElement) {
            pathElement.textContent = this.currentDirectory;
        }
        
        // Recargar archivos
        this.loadFilesForExplorer();
    }
    
    /**
     * Crea un nuevo archivo
     */
    createNewFile() {
        const fileName = prompt('Nombre del nuevo archivo:');
        if (!fileName) return;
        
        this.executeCommand(`touch ${fileName}`).then(() => {
            this.refreshFileExplorer();
        });
    }
    
    /**
     * Crea una nueva carpeta
     */
    createNewFolder() {
        const folderName = prompt('Nombre de la nueva carpeta:');
        if (!folderName) return;
        
        this.executeCommand(`mkdir ${folderName}`).then(() => {
            this.refreshFileExplorer();
        });
    }
    
    /**
     * Renombra un archivo
     */
    renameFile(fileName) {
        const newName = prompt('Nuevo nombre:', fileName);
        if (!newName || newName === fileName) return;
        
        this.executeCommand(`mv "${fileName}" "${newName}"`).then(() => {
            this.refreshFileExplorer();
        });
    }
    
    /**
     * Elimina un archivo
     */
    deleteFile(fileName) {
        if (confirm(`¿Estás seguro de que deseas eliminar "${fileName}"?`)) {
            this.executeCommand(`rm "${fileName}"`).then(() => {
                this.refreshFileExplorer();
            });
        }
    }
    
    /**
     * Copia la ruta de un archivo al portapapeles
     */
    copyFilePath(fileName) {
        const filePath = this.currentDirectory === '~' 
            ? `~/${fileName}` 
            : `${this.currentDirectory}/${fileName}`;
            
        navigator.clipboard.writeText(filePath)
            .then(() => this.appendOutput(`Ruta copiada al portapapeles: ${filePath}`, 'info'))
            .catch(err => this.appendOutput(`Error al copiar: ${err}`, 'error'));
    }
    
    /**
     * Configura la conexión Socket.IO
     */
    setSocket(socket) {
        this.socket = socket;
        
        if (socket) {
            socket.on('command_result', (data) => {
                this.handleCommandResult(data);
            });
            
            socket.on('assistant_response', (data) => {
                this.handleAssistantResponse(data);
            });
            
            socket.on('file_system_changed', () => {
                this.refreshFileExplorer();
            });
        }
    }
    
    /**
     * Agrega salida a la terminal
     */
    appendOutput(text, type = 'text') {
        if (!this.output) return;
        
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        // Agregar prompt para comandos
        if (type === 'command') {
            const prompt = document.createElement('span');
            prompt.className = 'terminal-prompt';
            prompt.textContent = this.options.promptText;
            line.appendChild(prompt);
        }
        
        // Agregar contenido de texto
        const content = document.createElement('span');
        content.className = 'terminal-content';
        
        // Manejar texto multilínea
        if (text.includes('\n')) {
            text.split('\n').forEach((textLine, index) => {
                if (index > 0) {
                    content.appendChild(document.createElement('br'));
                }
                content.appendChild(document.createTextNode(textLine));
            });
        } else {
            content.textContent = text;
        }
        
        line.appendChild(content);
        this.output.appendChild(line);
        
        // Limitar el número de líneas
        while (this.output.childNodes.length > this.options.maxLines) {
            this.output.removeChild(this.output.firstChild);
        }
        
        // Desplazar al fondo
        this.output.scrollTop = this.output.scrollHeight;
    }
    
    /**
     * Ejecuta un comando
     * @param {string} command - Comando a ejecutar
     * @param {boolean} display - Si se debe mostrar el comando en la terminal
     * @returns {Promise} Promesa que se resuelve con el resultado del comando
     */
    executeCommand(command, display = true) {
        // Mostrar el comando si display es true
        if (display) {
            this.appendOutput(command, 'command');
        }
        
        // Agregar al historial
        this.history.push(command);
        this.historyIndex = this.history.length;
        
        // Ejecutar a través de Socket.IO si está disponible
        if (this.socket && this.socket.isConnected) {
            return this.socket.sendCommand(command)
                .then(result => {
                    this.handleCommandResult(result);
                    return result;
                })
                .catch(error => {
                    this.appendOutput(`Error: ${error.message}`, 'error');
                    throw error;
                });
        } else {
            // Fallback a fetch API
            return fetch('/api/execute_command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command, cwd: this.currentDirectory })
            })
            .then(response => response.json())
            .then(result => {
                this.handleCommandResult(result);
                return result;
            })
            .catch(error => {
                this.appendOutput(`Error: ${error.message}`, 'error');
                throw error;
            });
        }
    }
    
    /**
     * Maneja el resultado de un comando
     */
    handleCommandResult(result) {
        if (result.success) {
            if (result.output) {
                this.appendOutput(result.output, 'text');
            }
            
            // Actualizar directorio actual si cambió
            if (result.cwd && result.cwd !== this.currentDirectory) {
                this.currentDirectory = result.cwd;
                this.refreshFileExplorer();
            }
        } else {
            this.appendOutput(result.error || 'Comando fallido', 'error');
        }
    }
    
    /**
     * Maneja la respuesta del asistente
     */
    handleAssistantResponse(response) {
        if (response.success) {
            // Mostrar explicación
            if (response.explanation) {
                this.appendOutput(response.explanation, 'info');
            }
            
            // Auto-ejecutar comando si se proporciona
            if (response.command && response.auto_execute) {
                setTimeout(() => {
                    this.executeCommand(response.command);
                }, 500);
            } else if (response.command) {
                this.appendOutput(`Comando sugerido: ${response.command}`, 'info');
            }
        } else {
            this.appendOutput(response.error || 'Procesamiento del asistente fallido', 'error');
        }
    }
    
    /**
     * Procesa instrucciones en lenguaje natural
     */
    processNaturalLanguage(text) {
        this.appendOutput(`Procesando: ${text}`, 'info');
        
        // Procesar a través de Socket.IO si está disponible
        if (this.socket && this.socket.isConnected) {
            return this.socket.processNaturalLanguage(text)
                .then(result => {
                    this.handleAssistantResponse(result);
                    return result;
                })
                .catch(error => {
                    this.appendOutput(`Error: ${error.message}`, 'error');
                    throw error;
                });
        } else {
            // Fallback a fetch API
            return fetch('/api/process_natural', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    text,
                    context: {
                        currentDirectory: this.currentDirectory
                    }
                })
            })
            .then(response => response.json())
            .then(result => {
                this.handleAssistantResponse(result);
                return result;
            })
            .catch(error => {
                this.appendOutput(`Error: ${error.message}`, 'error');
                throw error;
            });
        }
    }
    
    /**
     * Obtiene directorios que comienzan con un prefijo
     */
    getDirectoriesStartingWith(prefix) {
        // Esta es una implementación simulada
        // En una implementación real, consultaría al servidor
        return ['documentos', 'descargas', 'desktop', 'dev']
            .filter(dir => dir.startsWith(prefix));
    }
    
    /**
     * Limpia la salida de la terminal
     */
    clear() {
        if (this.output) {
            this.output.innerHTML = '';
            this.appendOutput('Terminal limpiada.', 'info');
            this.appendOutput(`Directorio actual: ${this.currentDirectory}`, 'info');
            this.appendOutput('', 'text');
        }
    }
}

// Hacer disponible globalmente
window.AugmentTerminal = AugmentTerminal;
