
/**
 * Codestorm Assistant - Módulo de Chat
 * Versión: 2.1.0 (Optimizado para nueva API)
 * Fecha: 14-05-2025
 */

// Namespace principal para la aplicación
window.app = window.app || {};
window.app.chat = window.app.chat || {};

// Asegurarse de que los endpoints API estén definidos
if (!window.app.apiEndpoints && !window.app.chat.apiEndpoints) {
    window.app.apiEndpoints = {
        chat: '/api/assistant/chat', // Corrected endpoint
        fallback: '/api/generate',
        health: '/api/health',
        processCode: '/api/process_code',
        execute: '/api/execute_command',
        files: '/api/files'
    };

    // Asignar endpoints al chat
    window.app.chat.apiEndpoints = window.app.apiEndpoints;
    console.log('Endpoints API inicializados:', window.app.chat.apiEndpoints);
}

/**
 * Función para logging silencioso (debug)
 * @param {...any} args - Argumentos a loggear
 */
function silentLog(...args) {
    if (window.app && window.app.chat && window.app.chat.debugMode) {
        console.log('[Chat]', ...args);
    }
}

/**
 * Inicialización inmediata de las estructuras básicas
 * Esto debe ejecutarse tan pronto como se cargue el script
 */
(function() {
    console.log('Inicializando estructuras básicas del chat desde chat.js...');

    // Inicializar la estructura básica de window.app
    window.app = window.app || {};
    window.app.chat = window.app.chat || {};

    // Inicializar propiedades básicas
    window.app.chat.context = window.app.chat.context || [];
    window.app.chat.chatMessageId = window.app.chat.chatMessageId || 0;
    window.app.chat.activeModel = window.app.chat.activeModel || 'openai';
    window.app.chat.activeAgent = window.app.chat.activeAgent || 'general';
    window.app.chat.debugMode = window.app.chat.debugMode || false;
    window.app.chat.elements = window.app.chat.elements || {};
    window.app.chat.initialized = false; // Flag para controlar la inicialización
    window.app.chat.clientId = window.app.chat.clientId || generateClientId();

    // Inicializar agentes disponibles si no existen
    if (!window.app.chat.availableAgents) {
        window.app.chat.availableAgents = {
            'general': {
                name: 'Asistente General',
                description: 'Asistente versátil para tareas diversas.',
                icon: 'robot',
                capabilities: [
                    'Resolución de consultas generales',
                    'Asistencia en proyectos diversos',
                    'Explicación de conceptos técnicos',
                    'Recomendación de recursos',
                    'Ayuda con herramientas de desarrollo'
                ]
            },
            'developer': {
                name: 'Desarrollador Experto',
                description: 'Especializado en escribir y depurar código.',
                icon: 'code-slash',
                capabilities: [
                    'Programación en múltiples lenguajes',
                    'Depuración de código y resolución de errores',
                    'Optimización de rendimiento',
                    'Implementación de algoritmos',
                    'Integración de APIs y servicios'
                ]
            },
            'architect': {
                name: 'Arquitecto de Software',
                description: 'Enfocado en diseño de sistemas y estructuras.',
                icon: 'diagram-3',
                capabilities: [
                    'Definición de estructura del proyecto',
                    'Selección de tecnologías y frameworks',
                    'Asesoría en elección de bases de datos',
                    'Implementación de microservicios',
                    'Planificación de UI/UX y patrones de diseño'
                ]
            },
            'advanced': {
                name: 'Especialista Avanzado',
                description: 'Para soluciones técnicas complejas y optimizaciones.',
                icon: 'gear-wide-connected',
                capabilities: [
                    'Arquitecturas de alta disponibilidad',
                    'Optimización de sistemas distribuidos',
                    'Seguridad y criptografía',
                    'Análisis de big data y ML',
                    'Soluciones cloud nativas'
                ]
            }
        };
    }

    // Inicializar modelos disponibles si no existen
    if (!window.app.chat.availableModels) {
        window.app.chat.availableModels = {
            'openai': 'OpenAI (GPT-4o) - Modelo avanzado con excelente seguimiento de instrucciones',
            'anthropic': 'Anthropic (Claude) - Especializado en desarrollo y automatización',
            'gemini': 'Google (Gemini) - Análisis de grandes bases de código'
        };
    }

    console.log('Estructuras básicas de chat inicializadas desde chat.js');
})();

/**
 * Función para copiar el contenido de un mensaje al portapapeles
 * @param {string|HTMLElement} messageId - El id del mensaje o elemento a copiar
 * @param {string} messageType - Tipo de mensaje (opcional)
 */
function copyToClipboard(messageId, messageType) {
    try {
        // Si messageId es un elemento HTML (botón), buscar el bloque de código asociado
        if (messageId instanceof HTMLElement) {
            const codeBlock = messageId.closest('.code-block-container')?.querySelector('code');
            if (codeBlock) {
                const textToCopy = codeBlock.textContent;

                navigator.clipboard.writeText(textToCopy).then(function() {
                    // Cambiar el texto del botón temporalmente
                    const originalText = messageId.innerHTML;
                    messageId.innerHTML = '<i class="bi bi-check"></i> Copiado';

                    // Restaurar el texto original después de 2 segundos
                    setTimeout(function() {
                        messageId.innerHTML = originalText;
                    }, 2000);

                    // Mostrar notificación si existe la función
                    if (typeof showNotification === 'function') {
                        showNotification('Código copiado al portapapeles', 'success');
                    }
                }).catch(function(err) {
                    console.error('Error al copiar texto: ', err);
                    alert('No se pudo copiar el texto. Por favor, inténtalo de nuevo.');
                });

                return;
            }
        }

        // Caso normal: messageId es un string con el ID del mensaje
        const messageContent = document.querySelector(`#${messageId} .message-content`);
        if (!messageContent) {
            throw new Error('No se encontró el contenido del mensaje');
        }

        // Usar clipboard API en lugar de document.execCommand (que está obsoleto)
        navigator.clipboard.writeText(messageContent.innerText || messageContent.textContent)
            .then(() => {
                // Proveer feedback al usuario
                const copyButton = document.getElementById(`copy-btn-${messageId}`);
                if (copyButton) {
                    copyButton.innerHTML = '<i class="bi bi-check"></i> Copiado';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
                    }, 2000); // Restablecer el ícono después de 2 segundos
                }

                silentLog(`Mensaje copiado: ${messageContent.innerText || messageContent.textContent}`);

                // Mostrar notificación si existe la función
                if (typeof showNotification === 'function') {
                    showNotification('Mensaje copiado al portapapeles', 'success');
                }
            })
            .catch(error => {
                console.error('Error al copiar el mensaje:', error);
                alert('Error al copiar el mensaje');
            });
    } catch (error) {
        console.error('Error al copiar el mensaje:', error);
        alert('Error al copiar el mensaje');
    }
}

/**
 * Inicializa el chat y configura los manejadores de eventos
 * Esta función debe ejecutarse cuando el DOM esté listo
 */
window.initializeChat = function() {
    // Evitar inicialización múltiple
    if (window.app.chat.initialized) {
        console.log('El chat ya está inicializado, omitiendo...');
        return;
    }

    console.log('Iniciando inicialización del chat...');

    // Verificar que las estructuras básicas estén inicializadas
    if (!window.app || !window.app.chat || !window.app.chat.availableAgents) {
        console.error('Error: window.app.chat no está inicializado correctamente');

        // Reinicializar
        window.app = window.app || {};
        window.app.chat = window.app.chat || {};
        window.app.chat.context = [];
        window.app.chat.chatMessageId = 0;
        window.app.chat.activeAgent = 'general';
        window.app.chat.activeModel = 'openai';
    }

    // Asegurar que existen todos los elementos necesarios antes de continuar
    ensureRequiredElements();

    // Configurar selectores y elementos de la UI
    setupUIElements();

    // Verificar conexión con el servidor
    checkServerConnection().catch(error => {
        console.warn('Continuando con funcionalidad limitada debido a error de conexión:', error);
    });

    // Inicializar características avanzadas
    setupDocumentFeatures();

    // Inicializar funcionalidades de UI
    initializeUIFeatures();

    // Configurar eventos para el selector de agentes
    setupAgentSelector();

    // Marcar como inicializado
    window.app.chat.initialized = true;

    console.log('Chat inicializado correctamente');
};

/**
 * Envía un mensaje al chat y procesa la respuesta real de la API
 * @param {string} message - Mensaje a enviar
 */
function sendMessage(message) {
    // Verificar que el mensaje no esté vacío
    const messageText = typeof message === 'string' ? message.trim() : '';
    if (!messageText) return;
    
    console.log(`Enviando mensaje a la API: "${messageText.substring(0, 30)}..."`);
    
    // Verificar que window.app.chat esté inicializado
    if (!window.app || !window.app.chat) {
        console.error("Error: window.app.chat no está inicializado");
        
        // Inicializar estructuras básicas
        window.app = window.app || {};
        window.app.chat = window.app.chat || {};
        window.app.chat.context = [];
        window.app.chat.chatMessageId = 0;
        window.app.chat.activeAgent = 'general';
        window.app.chat.activeModel = 'openai';
    }
    
    // Añadir mensaje del usuario al chat
    addUserMessage(messageText);
    
    // Limpiar el input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.value = '';
        if (typeof adjustTextareaHeight === 'function') {
            adjustTextareaHeight(messageInput);
        }
    }
    
    // Obtener el agente y modelo seleccionados
    const agentSelect = document.getElementById('agent-select');
    const modelSelect = document.getElementById('model-select');
    
    const agentId = agentSelect ? agentSelect.value : window.app.chat.activeAgent || 'general';
    const model = modelSelect ? modelSelect.value : window.app.chat.activeModel || 'openai';
    
    // Mostrar indicador de carga
    const loadingId = showLoadingIndicator();
    
    // Guardar mensaje en el contexto
    if (window.app.chat.context) {
        window.app.chat.context.push({ role: 'user', content: messageText });
        
        // Limitar el contexto a los últimos 10 mensajes para evitar problemas de tokens
        if (window.app.chat.context.length > 10) {
            window.app.chat.context = window.app.chat.context.slice(-10);
        }
    }
    
    // Crear objeto de datos para enviar
    const requestData = {
        message: messageText,
        agent_id: agentId,
        model: model,
        context: window.app.chat.context || [],
        timestamp: new Date().toISOString(),
        client_id: window.app.chat.clientId || generateClientId()
    };
    
    console.log('Enviando datos a la API:', {
        message_length: messageText.length,
        agent_id: agentId,
        model: model,
        context_size: window.app.chat.context?.length || 0
    });
    
    // Configurar timeout para la solicitud
    const timeoutDuration = 60000; // 60 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    // Enviar al backend - API real
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': window.app.chat.clientId || 'unknown',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        console.log('Respuesta recibida, status:', response.status);
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Respuesta recibida de la API:", {
            success: data.success,
            response_length: data.response?.length || 0,
            has_metrics: !!data.metrics,
            model: data.model || model,
            is_fallback: !!data.is_fallback
        });
        
        // Eliminar indicador de carga
        removeLoadingIndicator(loadingId);
        
        // Verificar si hay error en la respuesta
        if (data.error || data.success === false) {
            const errorMsg = data.error || "Error desconocido en la respuesta";
            console.error("Error en la respuesta:", errorMsg);
            addSystemMessage(`Error: ${errorMsg}`);
            return;
        }
        
        // Obtener la respuesta real de la API
        const responseText = data.response || '';
        
        if (!responseText) {
            console.error("No se recibió respuesta del servidor");
            addSystemMessage("Error: No se recibió respuesta del servidor");
            return;
        }
        
        // Mostrar métricas si están disponibles
        if (data.metrics) {
            console.log("Métricas de la API:", data.metrics);
            const responseTime = data.metrics.response_time || 0;
            addSystemMessage(`Respuesta generada en ${responseTime} segundos`);
        }
        
        // Añadir respuesta del asistente
        addRealAgentMessage(responseText, agentId);
        
        // Guardar en el contexto
        if (window.app.chat.context) {
            window.app.chat.context.push({ role: 'assistant', content: responseText });
            
            // Limitar el contexto a los últimos 10 mensajes
            if (window.app.chat.context.length > 10) {
                window.app.chat.context = window.app.chat.context.slice(-10);
            }
        }
    })
    .catch(error => {
        clearTimeout(timeoutId);
        
        // Eliminar indicador de carga
        removeLoadingIndicator(loadingId);
        
        // Manejar errores específicos
        if (error.name === 'AbortError') {
            console.error('La solicitud excedió el tiempo límite:', error);
            addSystemMessage(`Error: La solicitud excedió el tiempo límite de ${timeoutDuration/1000} segundos`);
        } else {
            console.error('Error en la comunicación con el backend:', error);
            addSystemMessage(`Error de conexión: ${error.message}`);
        }
        
        // Intentar con endpoint de fallback
        tryFallbackEndpoint(messageText, agentId, model);
    });
}

// Exponer la función sendMessage globalmente
window.app.chat.sendMessage = sendMessage;

/**
 * Añade un mensaje del usuario al chat
 * @param {string} message - El contenido del mensaje
 */
function addUserMessage(message) {
    if (!message) return;

    // Asegurarse de que window.app y window.app.chat estén inicializados
    if (!window.app || !window.app.chat) {
        window.app = window.app || {};
        window.app.chat = window.app.chat || {};
        window.app.chat.chatMessageId = window.app.chat.chatMessageId || 0;
    }

    // Generar ID único para el mensaje
    const messageId = `msg-${Date.now()}-${window.app.chat.chatMessageId++}`;

    // HTML del mensaje
    const messageHTML = `
        <div id="${messageId}" class="message-container">
            <div class="user-message">
                <div class="message-header">
                    <div class="message-sender">Tú</div>
                    <div class="message-time">${getCurrentTime()}</div>
                </div>
                <div class="message-content">${formatMessage(message)}</div>
                <div class="message-actions">
                    <button id="copy-btn-${messageId}" class="btn-icon" onclick="window.app.chat.copyToClipboard('${messageId}')">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Añadir al chat
    appendMessageToChat(messageHTML);

    // Scroll automático
    scrollToBottom();
}

/**
 * Añade un mensaje del agente al chat
 * @param {string} message - El contenido del mensaje
 * @param {string} agentId - ID del agente que envía el mensaje
 */
function addAgentMessage(message, agentId) {
    // Verificar que no sea una respuesta simulada
    if (message.includes("Esta es una respuesta simulada") || 
        message.includes("En un entorno real, esto sería reemplazado")) {
        console.error("Se detectó una respuesta simulada. Intentando obtener respuesta real...");
        
        // Mostrar mensaje de error al usuario
        addSystemMessage("Error: Se detectó una respuesta simulada. Intentando obtener respuesta real...");
        
        // Intentar obtener una respuesta real directamente
        const lastUserMessage = window.app.chat.context && 
                               window.app.chat.context.length > 0 && 
                               window.app.chat.context[window.app.chat.context.length - 2] &&
                               window.app.chat.context[window.app.chat.context.length - 2].role === 'user' ?
                               window.app.chat.context[window.app.chat.context.length - 2].content : '';
        
        if (lastUserMessage) {
            // Intentar con el endpoint directo
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: lastUserMessage,
                    agent_id: agentId,
                    model: window.app.chat.activeModel || 'openai',
                    direct_call: true  // Indicar que es una llamada directa
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.response && !data.response.includes("Esta es una respuesta simulada")) {
                    // Si obtenemos una respuesta real, la mostramos
                    addRealAgentMessage(data.response, agentId);
                } else {
                    // Si seguimos obteniendo una respuesta simulada, mostramos un error
                    addSystemMessage("Error: No se pudo obtener una respuesta real del servidor. Verifica la configuración de las APIs.");
                }
            })
            .catch(error => {
                console.error("Error al intentar obtener respuesta real:", error);
                addSystemMessage("Error al intentar obtener respuesta real: " + error.message);
            });
        }
        
        return;
    }
    
    // Si llegamos aquí, es una respuesta real
    addRealAgentMessage(message, agentId);
}

/**
 * Añade un mensaje real del agente al chat
 * @param {string} message - El contenido del mensaje
 * @param {string} agentId - ID del agente que envía el mensaje
 */
function addRealAgentMessage(message, agentId) {
    if (!message) {
        console.error("Mensaje vacío en addRealAgentMessage");
        return;
    }
    
    console.log(`Añadiendo mensaje real del agente ${agentId}: ${message.substring(0, 50)}...`);
    
    // Asegurarse de que window.app y window.app.chat estén inicializados
    if (!window.app || !window.app.chat) {
        console.error("window.app.chat no inicializado en addRealAgentMessage");
        window.app = window.app || {};
        window.app.chat = window.app.chat || {};
        window.app.chat.chatMessageId = window.app.chat.chatMessageId || 0;
        window.app.chat.availableAgents = window.app.chat.availableAgents || {
            'general': {
                name: 'Asistente General',
                icon: 'robot'
            }
        };
    }
    
    // Obtener información del agente
    const agent = window.app.chat.availableAgents[agentId] || window.app.chat.availableAgents['general'];
    
    // Generar ID único para el mensaje
    const messageId = `msg-${Date.now()}-${window.app.chat.chatMessageId++}`;
    
    // Obtener el contenedor de mensajes
    const messagesContainer = window.app.chat.elements?.messagesContainer || 
                             document.getElementById('messages-container') || 
                             document.getElementById('chat-messages');
    
    if (!messagesContainer) {
        console.error("No se encontró el contenedor de mensajes");
        return;
    }
    
    // Crear elemento para el mensaje
    const messageElement = document.createElement('div');
    messageElement.id = messageId;
    messageElement.className = 'message-container agent-container';
    
    // Formatear el mensaje (código, enlaces, etc.)
    const formattedMessage = formatMessage(message);
    
    // Crear HTML del mensaje
    messageElement.innerHTML = `
        <div class="agent-message">
            <div class="message-header">
                <div class="agent-info">
                    <span class="agent-icon"><i class="bi bi-${agent.icon || 'robot'}"></i></span>
                    <span class="agent-name">${agent.name || 'Asistente'}</span>
                </div>
                <div class="message-actions">
                    <button class="copy-btn" id="copy-btn-${messageId}" onclick="copyToClipboard('${messageId}')">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </div>
            </div>
            <div class="message-content">${formattedMessage}</div>
            <div class="message-footer">
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    `;
    
    // Añadir al contenedor
    messagesContainer.appendChild(messageElement);
    
    // Hacer scroll al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Aplicar resaltado de sintaxis si está disponible
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(messageElement);
    }
    
    console.log(`Mensaje real del agente añadido con ID: ${messageId}`);
}

/**
 * Añade un mensaje del sistema al chat
 * @param {string} message - El contenido del mensaje
 */
function addSystemMessage(message) {
    if (!message) return;

    // Asegurarse de que window.app y window.app.chat estén inicializados
    if (!window.app || !window.app.chat) {
        window.app = window.app || {};
        window.app.chat = window.app.chat || {};
        window.app.chat.chatMessageId = window.app.chat.chatMessageId || 0;
    }

    // Generar ID único para el mensaje
    const messageId = `msg-${Date.now()}-${window.app.chat.chatMessageId++}`;

    // HTML del mensaje
    const messageHTML = `
        <div id="${messageId}" class="message-container system-message">
            <div class="message-content">${message}</div>
            <div class="message-time">${getCurrentTime()}</div>
        </div>
    `;

    // Añadir al chat
    appendMessageToChat(messageHTML);

    // Scroll automático
    scrollToBottom();
}

/**
 * Añade un HTML de mensaje al contenedor de chat
 * @param {string} messageHTML - El HTML del mensaje a añadir
 */
function appendMessageToChat(messageHTML) {
    const messagesContainer = document.getElementById('messages-container') ||
                             document.getElementById('chat-messages');

    if (messagesContainer) {
        // Añadir mensaje al final del contenedor
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    } else {
        console.error('No se encontró el contenedor de mensajes');

        // Intentar crear el contenedor si no existe
        const mainContent = document.querySelector('.main-content') || document.querySelector('.content') || document.body;

        if (mainContent) {
            const newMessagesContainer = document.createElement('div');
            newMessagesContainer.id = 'messages-container';
            newMessagesContainer.className = 'messages-container';

            mainContent.appendChild(newMessagesContainer);
            newMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);

            console.log('Contenedor de mensajes creado dinámicamente');
        }
    }
}

/**
 * Formatea un mensaje para mostrar código, enlaces, etc.
 * @param {string} message - El mensaje a formatear
 * @returns {string} - El mensaje formateado con HTML
 */
function formatMessage(message) {
    if (!message) return '';
    
    console.log('Formateando mensaje...');
    
    // Escapar HTML para evitar inyección de código
    let formatted = escapeHtml(message);
    
    // Formatear bloques de código
    formatted = formatted.replace(/```([\s\S]+?)```/g, function(match, code) {
        // Detectar lenguaje si está especificado
        const langMatch = code.match(/^([a-zA-Z]+)\n([\s\S]+)$/);
        
        if (langMatch) {
            const language = langMatch[1];
            const codeContent = langMatch[2];
            return `<div class="code-block-container">
                <div class="code-header">
                    <span class="code-language">${language}</span>
                    <button class="code-copy-btn" onclick="copyToClipboard(this)">
                        <i class="bi bi-clipboard"></i> Copiar
                    </button>
                </div>
                <pre><code class="language-${language}">${codeContent}</code></pre>
            </div>`;
        } else {
            return `<div class="code-block-container">
                <div class="code-header">
                    <span class="code-language">código</span>
                    <button class="code-copy-btn" onclick="copyToClipboard(this)">
                        <i class="bi bi-clipboard"></i> Copiar
                    </button>
                </div>
                <pre><code>${code}</code></pre>
            </div>`;
        }
    });
    
    // Formatear código en línea
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Formatear enlaces
    formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Convertir saltos de línea en <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Hacer scroll al final del contenedor de mensajes
 */
function scrollToBottom() {
    const messagesContainer = window.app.chat.elements?.messagesContainer ||
                             document.getElementById('messages-container') ||
                             document.getElementById('chat-messages');

    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

/**
 * Obtiene el nombre del agente a partir de su ID
 * @param {string} agentId - ID del agente
 * @returns {string} - Nombre del agente
 */
function getAgentName(agentId) {
    const agents = window.app.chat.availableAgents || {};
    return (agents[agentId] && agents[agentId].name) || 'Asistente';
}

/**
 * Cambia el agente activo y actualiza la UI
 * @param {string} agentId - ID del agente a activar
 */
function setActiveAgent(agentId) {
    // Verificar que el agente existe
    const agents = window.app.chat.availableAgents || {};
    const agent = agents[agentId];

    if (!agent) {
        console.error(`Agente no encontrado: ${agentId}`);
        return;
    }

    // Actualizar el agente activo en la configuración
    window.app.chat.activeAgent = agentId;

    // Actualización de la UI
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

    // Actualizar selector visual de agentes
    const agentOptions = document.querySelectorAll('.agent-option');
    agentOptions.forEach(option => {
        if (option.dataset.value === agentId) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });

    // Añadir mensaje de sistema sobre el cambio
    addSystemMessage(`Cambiado a: ${agent.name}`);

    console.log(`Agente cambiado a: ${agent.name} (${agentId})`);
}

// Asignar la función al namespace de la app
window.app.chat.setActiveAgent = setActiveAgent;

/**
 * Escapa caracteres HTML para evitar inyección de código
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Obtiene la hora actual formateada
 * @returns {string} - Hora actual formateada
 */
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

/**
 * Carga highlight.js para resaltado de código
 */
function loadHighlightJS() {
    // Verificar si ya está cargado
    if (window.hljs) {
        silentLog('highlight.js ya está cargado');
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        try {
            // Crear script para highlight.js
            const highlightScript = document.createElement('script');
            highlightScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';

            // Callback cuando el script se carga
            highlightScript.onload = function() {
                // Crear link para CSS de highlight.js
                const highlightCSS = document.createElement('link');
                highlightCSS.rel = 'stylesheet';
                highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css';

                // Añadir CSS
                document.head.appendChild(highlightCSS);

                silentLog('highlight.js cargado correctamente');

                // Aplicar highlight a todos los bloques de código existentes
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });

                resolve();
            };

            // Manejar errores
            highlightScript.onerror = function(err) {
                console.error('Error al cargar highlight.js:', err);
                reject(err);
            };

            // Añadir script al DOM
            document.head.appendChild(highlightScript);

        } catch (error) {
            console.error('Error al configurar highlight.js:', error);
            reject(error);
        }
    });
}

/**
 * Configurar elementos de la UI y referencias
 */
function setupUIElements() {
    console.log('Configurando elementos de la UI...');

    // Asegurarse de que window.app.chat.elements esté inicializado
    window.app.chat.elements = window.app.chat.elements || {};

    // Obtener referencias a los elementos principales
    window.app.chat.elements.messagesContainer = document.getElementById('messages-container') || document.getElementById('chat-messages');
    window.app.chat.elements.messageInput = document.getElementById('message-input');
    window.app.chat.elements.sendButton = document.getElementById('send-button');
    window.app.chat.elements.sendToAgentButton = document.getElementById('send-to-agent');
    window.app.chat.elements.agentSelect = document.getElementById('agent-select');
    window.app.chat.elements.modelSelect = document.getElementById('model-select');

    // Verificar si los elementos necesarios están presentes
    const missingElements = [];
    if (!window.app.chat.elements.messagesContainer) missingElements.push('contenedor de mensajes');
    if (!window.app.chat.elements.messageInput) missingElements.push('campo de entrada');
    if (!window.app.chat.elements.sendButton) missingElements.push('botón de enviar');

    if (missingElements.length > 0) {
        console.warn(`Elementos faltantes: ${missingElements.join(', ')}`);
    } else {
        console.log('Todos los elementos necesarios encontrados');
    }

    // Configurar eventos
    if (window.app.chat.elements.sendButton) {
        window.app.chat.elements.sendButton.addEventListener('click', function() {
            const messageInput = window.app.chat.elements.messageInput;
            if (messageInput && messageInput.value.trim()) {
                sendMessage(messageInput.value);
            }
        });
    }

    if (window.app.chat.elements.sendToAgentButton) {
        window.app.chat.elements.sendToAgentButton.addEventListener('click', function() {
            sendToAgent();
        });
    }

    if (window.app.chat.elements.messageInput) {
        window.app.chat.elements.messageInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (this.value.trim()) {
                    sendMessage(this.value);
                }
            }
        });

        // Ajustar altura automáticamente al escribir
        window.app.chat.elements.messageInput.addEventListener('input', function() {
            adjustTextareaHeight(this);
        });
    }

    console.log('Elementos de la UI configurados');
}

/**
 * Ajusta la altura del textarea automáticamente
 * @param {HTMLTextAreaElement} textarea - El elemento textarea a ajustar
 */
function adjustTextareaHeight(textarea) {
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;

        // Limitar altura máxima
        if (textarea.scrollHeight > 150) {
            textarea.style.height = '150px';
        }
    }
}

/**
 * Muestra un indicador de carga en el chat
 * @returns {string} - ID del indicador de carga
 */
function showLoadingIndicator() {
    console.log('Mostrando indicador de carga...');
    
    // Generar ID único para el indicador
    const loadingId = `loading-${Date.now()}`;
    
    // Obtener el contenedor de mensajes
    const messagesContainer = window.app.chat.elements?.messagesContainer || 
                             document.getElementById('messages-container') || 
                             document.getElementById('chat-messages');
    
    if (!messagesContainer) {
        console.error("No se encontró el contenedor de mensajes");
        return loadingId;
    }
    
    // Crear elemento para el indicador
    const loadingElement = document.createElement('div');
    loadingElement.id = loadingId;
    loadingElement.className = 'loading-indicator';
    loadingElement.innerHTML = `
        <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
    `;
    
    // Añadir al contenedor
    messagesContainer.appendChild(loadingElement);
    
    // Hacer scroll al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return loadingId;
}

/**
 * Elimina el indicador de carga del chat
 * @param {string} loadingId - ID del indicador de carga a eliminar
 */
function removeLoadingIndicator(loadingId) {
    console.log(`Eliminando indicador de carga: ${loadingId}`);
    
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
        loadingElement.remove();
    } else {
        console.warn(`No se encontró el indicador de carga con ID: ${loadingId}`);
        
        // Intentar eliminar cualquier indicador de carga
        const loadingIndicators = document.querySelectorAll('.loading-indicator');
        loadingIndicators.forEach(indicator => {
            indicator.remove();
        });
    }
}

/**
 * Verifica la conexión con el servidor
 * @returns {Promise} - Promesa que se resuelve con el estado del servidor
 */
function checkServerConnection() {
    console.log('Verificando conexión con el servidor...');
    
    // Obtener la URL del endpoint desde la configuración
    const healthEndpoint = (window.app.chat.apiEndpoints && window.app.chat.apiEndpoints.health) || '/api/health';
    
    // Intentar primero el endpoint principal, luego el simple si falla
    return fetch(healthEndpoint)
        .then(response => {
            console.log(`Health check response: ${response.status}`);
            if (!response.ok) {
                console.warn(`Health check returned status: ${response.status}, trying simple endpoint`);
                // Si falla, intentar con el endpoint simple
                return fetch('/health').then(r => {
                    if (!r.ok) {
                        console.error('Both health checks failed');
                        throw new Error('Error de conexión al servidor: ' + response.status);
                    }
                    return r.json();
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Health check data:', data);
            
            if (data.status !== 'ok' && data.status !== 'limited') {
                throw new Error('Servidor no disponible: ' + data.status);
            }
            
            // Actualizar estado en la UI
            updateServerStatus(data.status);
            
            // También aceptar estado 'limited' para funcionalidad básica
            return data;
        })
        .catch(error => {
            console.error('Error al verificar la conexión con el servidor:', error);
            
            // Actualizar estado en la UI
            updateServerStatus('offline');
            
            // Intentar una última verificación directa a la API de chat
            console.log('Intentando verificación directa a la API de chat...');
            
            return fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'ping',
                    agent_id: 'general',
                    model: 'openai'
                })
            })
            .then(response => {
                if (response.ok) {
                    console.log('API de chat responde correctamente');
                    updateServerStatus('limited');
                    return { status: 'limited' };
                } else {
                    throw new Error('API de chat no responde');
                }
            })
            .catch(chatError => {
                console.error('Error en verificación directa a la API de chat:', chatError);
                // Si falla todo, intentar continuar con funcionalidad limitada
                window.serverOffline = true;
                throw error;
            });
        });
}

/**
 * Actualiza el indicador de estado del servidor en la UI
 * @param {string} status - Estado del servidor ('ok', 'limited', 'offline')
 */
function updateServerStatus(status) {
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;

    // Eliminar clases anteriores
    statusIndicator.classList.remove('status-ok', 'status-limited', 'status-offline');

    // Añadir clase según estado
    switch (status) {
        case 'ok':
            statusIndicator.classList.add('status-ok');
            statusIndicator.title = 'Servidor conectado';
            break;
        case 'limited':
            statusIndicator.classList.add('status-limited');
            statusIndicator.title = 'Servidor con funcionalidad limitada';
            break;
        case 'offline':
        default:
            statusIndicator.classList.add('status-offline');
            statusIndicator.title = 'Servidor desconectado';
            break;
    }
}

/**
 * Configura características adicionales del documento
 */
function setupDocumentFeatures() {
    // Cargar highlight.js si no está cargado
    loadHighlightJS().catch(err => {
        console.warn('No se pudo cargar highlight.js:', err);
    });

    // Configurar observer para formatear bloques de código nuevos
    const messagesContainer = document.getElementById('messages-container') ||
                             document.getElementById('chat-messages');

    if (messagesContainer && window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length && window.hljs) {
                    // Formatear bloques de código nuevos
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Elemento
                            const codeBlocks = node.querySelectorAll('pre code');
                            codeBlocks.forEach(block => {
                                hljs.highlightElement(block);
                            });
                        }
                    });
                }
            });
        });

        observer.observe(messagesContainer, { childList: true, subtree: true });
        silentLog('Observer configurado para formatear bloques de código');
    }
}

/**
 * Configura el selector de agentes personalizado
 */
function setupAgentSelector() {
    const agentOptions = document.querySelectorAll('.agent-option');
    const agentSelect = document.getElementById('agent-select');

    if (!agentOptions.length || !agentSelect) return;

    agentOptions.forEach(option => {
        option.addEventListener('click', function() {
            const value = this.dataset.value;

            // Actualizar la opción seleccionada visualmente
            agentOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');

            // Actualizar el select oculto
            agentSelect.value = value;

            // Cambiar el agente activo
            setActiveAgent(value);

            // Mostrar notificación
            showNotification(`Agente cambiado a: ${this.querySelector('.agent-option-text').textContent}`);
        });
    });
}

/**
 * Muestra una notificación tipo toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación ('info', 'success', 'error', 'warning')
 */
function showNotification(message, type = 'info') {
    // Verificar si ya existe la función en window
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        return window.showNotification(message, type);
    }

    const notificationContainer = document.createElement('div');
    notificationContainer.className = `toast-notification toast-${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    notificationContainer.innerHTML = `
        <i class="bi bi-${icon}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notificationContainer);

    // Añadir clase para animar entrada
    setTimeout(() => {
        notificationContainer.classList.add('show');
    }, 10);

    // Remover después de la animación
    setTimeout(() => {
        notificationContainer.classList.remove('show');
        setTimeout(() => {
            notificationContainer.remove();
        }, 300);
    }, 3000);
}

// Exponer la función de notificación globalmente
window.showNotification = showNotification;

/**
 * Inicializa las funcionalidades adicionales de la interfaz
 */
function initializeUIFeatures() {
    // Toggle para el panel lateral
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.getElementById('main-content');

    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            if (mainContent) {
                mainContent.classList.toggle('expanded');
            }

            // Cambiar el icono del botón
            const icon = this.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('collapsed')) {
                    icon.classList.remove('bi-layout-sidebar');
                    icon.classList.add('bi-layout-sidebar-inset');
                } else {
                    icon.classList.remove('bi-layout-sidebar-inset');
                    icon.classList.add('bi-layout-sidebar');
                }
            }
        });
    }

    // Configurar el menú flotante para móvil
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileFloatMenu = document.getElementById('mobile-float-menu');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (mobileMenuToggle && mobileFloatMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileFloatMenu.classList.toggle('show');
            if (mobileOverlay) {
                mobileOverlay.classList.toggle('show', mobileFloatMenu.classList.contains('show'));
            }
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', function(e) {
            if (mobileFloatMenu && mobileFloatMenu.classList.contains('show') &&
                !mobileMenuToggle.contains(e.target) &&
                !mobileFloatMenu.contains(e.target)) {
                mobileFloatMenu.classList.remove('show');
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('show');
                }
            }
        });
    }

    // Configurar botón para limpiar chat
    const mobileClearChat = document.getElementById('mobile-clear-terminal');
    if (mobileClearChat) {
        mobileClearChat.addEventListener('click', function() {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                // Mantener solo el mensaje de bienvenida
                messagesContainer.innerHTML = `
                    <div class="message-container system-message">
                        <div class="message-content">
                            ¡Bienvenido a Codestorm Assistant! Selecciona un modelo y agente para comenzar.
                        </div>
                    </div>
                `;

                // Reiniciar contexto
                window.app.chat.context = [];

                // Cerrar menú flotante
                if (mobileFloatMenu) {
                    mobileFloatMenu.classList.remove('show');
                }
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('show');
                }

                // Mostrar notificación
                showNotification('Chat limpiado correctamente', 'success');
            }
        });
    }

    // Añadir efecto ripple a los botones
    function addRippleEffect(button) {
        if (!button) return;

        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            this.appendChild(ripple);

            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }

    // Aplicar efecto ripple a todos los botones
    document.querySelectorAll('.btn, .btn-icon, .send-button, .mobile-btn, .float-btn').forEach(button => {
        addRippleEffect(button);
    });

    // Asegurar que el código se muestre correctamente
    function adjustCodeBlocks() {
        document.querySelectorAll('.message-content pre').forEach(pre => {
            pre.style.maxWidth = '100%';
            pre.style.overflowX = 'auto';
        });
    }

    // Aplicar ajustes iniciales
    adjustCodeBlocks();

    // Observar cambios en el DOM para ajustar nuevos bloques de código
    const messagesContainer = document.getElementById('messages-container') ||
                             document.getElementById('chat-messages');

    if (messagesContainer && window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    adjustCodeBlocks();
                }
            });
        });

        observer.observe(messagesContainer, { childList: true, subtree: true });
        console.log('Observer para mensajes de chat configurado');
    }
}

/**
 * Envía el último intercambio de la conversación al webhook de Make
 */
function sendToAgent() {
    console.log('Enviando último intercambio al webhook de Make...');
    
    // URL del webhook de Make (esta es la URL que aparece en tu HTML)
    const webhookUrl = 'https://hook.us1.make.com/v7j3mob75olqi3pk8i1qjfp4b2gic9lw';
    
    // Obtener el contenedor de mensajes
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        console.error('No se encontró el contenedor de mensajes');
        showNotification('Error: No se pudo encontrar el contenedor de mensajes', 'error');
        return;
    }
    
    // Obtener todos los mensajes
    const messageElements = messagesContainer.querySelectorAll('.message-container');
    if (messageElements.length === 0) {
        showNotification('No hay mensajes para enviar', 'warning');
        return;
    }
    
    // Encontrar el último mensaje del usuario y la última respuesta del asistente
    let lastUserMessage = null;
    let lastAssistantMessage = null;
    
    // Recorrer los mensajes en orden inverso para encontrar los últimos
    for (let i = messageElements.length - 1; i >= 0; i--) {
        const element = messageElements[i];
        
        // Buscar mensaje del usuario
        if (!lastUserMessage && element.querySelector('.user-message')) {
            const content = element.querySelector('.message-content')?.innerText || '';
            lastUserMessage = {
                content: content,
                timestamp: element.querySelector('.message-time')?.innerText || new Date().toLocaleTimeString()
            };
        }
        
        // Buscar mensaje del asistente
        if (!lastAssistantMessage && element.querySelector('.agent-message')) {
            const content = element.querySelector('.message-content')?.innerText || '';
            lastAssistantMessage = {
                content: content,
                timestamp: element.querySelector('.message-time')?.innerText || new Date().toLocaleTimeString()
            };
        }
        
        // Si ya tenemos ambos mensajes, salir del bucle
        if (lastUserMessage && lastAssistantMessage) {
            break;
        }
    }
    
    // Verificar que tengamos al menos un mensaje para enviar
    if (!lastUserMessage && !lastAssistantMessage) {
        showNotification('No se encontraron mensajes para enviar', 'warning');
        return;
    }
    
    // Crear el objeto de datos a enviar
    const payload = {
        title: "Último intercambio de conversación",
        timestamp: new Date().toISOString(),
        userMessage: lastUserMessage ? lastUserMessage.content : "No hay mensaje del usuario",
        assistantResponse: lastAssistantMessage ? lastAssistantMessage.content : "No hay respuesta del asistente",
        agent: window.app.chat.activeAgent || 'general',
        model: window.app.chat.activeModel || 'openai',
        clientId: window.app.chat.clientId || generateClientId()
    };
    
    // Mostrar indicador de carga
    const loadingId = showLoadingIndicator();
    
    // Enviar al webhook
    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        // Eliminar indicador de carga
        removeLoadingIndicator(loadingId);
        
        if (response.ok) {
            console.log('Intercambio enviado correctamente al webhook');
            addSystemMessage('✅ Último intercambio enviado correctamente al agente especializado');
            showNotification('Intercambio enviado correctamente', 'success');
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
    })
    .catch(error => {
        // Eliminar indicador de carga
        removeLoadingIndicator(loadingId);
        
        console.error('Error al enviar al webhook:', error);
        addSystemMessage('❌ Error al enviar el intercambio: ' + error.message);
        showNotification('Error al enviar el intercambio', 'error');
    });
}

/**
 * Cambia el agente activo
 * @param {string} agentId - ID del agente a activar
 */
function changeAgent(agentId) {
    if (!agentId) return;

    // Obtener información del agente
    const agent = window.app.chat.availableAgents[agentId];
    if (!agent) return;

    // Actualizar el agente activo
    window.app.chat.activeAgent = agentId;

    // Actualizar la UI
    const agentSelect = document.getElementById('agent-select');
    if (agentSelect) {
        agentSelect.value = agentId;
    }

    // Actualizar el nombre del agente en la interfaz
    const agentNameElement = document.getElementById('agent-name');
    if (agentNameElement) {
        agentNameElement.textContent = agent.name;
    }

    // Añadir mensaje de sistema
    const systemMessage = `Has cambiado al <strong>${agent.name}</strong>. ${agent.description || ''}`;
    addSystemMessage(systemMessage);

    // Notificar al usuario
    showNotification(`Agente cambiado a: ${agent.name}`);

    console.log(`Agente cambiado a: ${agent.name} (${agentId})`);
}

/**
 * Asegura que existan todos los elementos necesarios para el chat
 * Esta es la función clave para resolver el error
 */
function ensureRequiredElements() {
    console.log('Verificando y creando elementos necesarios...');

    // 1. Verificar panel principal
    let panel = document.querySelector('.chat-panel') || document.querySelector('.main-panel');
    if (!panel) {
        console.warn('Creando panel principal...');
        panel = document.createElement('div');
        panel.className = 'chat-panel';
        document.body.appendChild(panel);
    }

    // 2. Verificar contenedor de mensajes
    let messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        messagesContainer = document.getElementById('chat-messages');

        if (!messagesContainer) {
            console.warn('Creando contenedor de mensajes...');
            messagesContainer = document.createElement('div');
            messagesContainer.id = 'messages-container';
            messagesContainer.className = 'messages-container';
            panel.appendChild(messagesContainer);

            // Añadir mensaje de bienvenida
            messagesContainer.innerHTML = `
                <div class="message-container system-message">
                    <div class="message-content">
                        ¡Bienvenido a Codestorm Assistant! Selecciona un modelo y agente para comenzar.
                    </div>
                </div>
            `;
        }
    }

    // 3. Verificar contenedor de entrada
    let inputContainer = document.querySelector('.chat-input-container');
    if (!inputContainer) {
        console.warn('Creando contenedor de entrada...');
        inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';
        panel.appendChild(inputContainer);
    }

      // 4. Verificar input de mensajes
      let messageInput = document.getElementById('message-input');
      if (!messageInput) {
          console.warn('Creando input de mensajes...');
          messageInput = document.createElement('textarea');
          messageInput.id = 'message-input';
          messageInput.className = 'message-input';
          messageInput.placeholder = 'Escribe un mensaje...';
          messageInput.rows = 1;
          inputContainer.appendChild(messageInput);
      }
  
      // 5. Verificar botón de enviar
      let sendButton = document.getElementById('send-button');
      if (!sendButton) {
          console.warn('Creando botón de enviar...');
          sendButton = document.createElement('button');
          sendButton.id = 'send-button';
          sendButton.className = 'send-button';
          sendButton.innerHTML = '<i class="bi bi-send"></i>';
          inputContainer.appendChild(sendButton);
      }
  
      // 6. Verificar selector de agentes
      let agentSelect = document.getElementById('agent-select');
      if (!agentSelect) {
          console.warn('Creando selector de agentes (oculto)...');
          agentSelect = document.createElement('select');
          agentSelect.id = 'agent-select';
          agentSelect.className = 'hidden-select';
  
          // Añadir opciones de agentes
          for (const [id, agent] of Object.entries(window.app.chat.availableAgents || {})) {
              const option = document.createElement('option');
              option.value = id;
              option.textContent = agent.name;
              agentSelect.appendChild(option);
          }
  
          // Seleccionar agente activo
          agentSelect.value = window.app.chat.activeAgent || 'general';
  
          // Añadir al DOM
          document.body.appendChild(agentSelect);
      }
  
      // 7. Verificar selector de modelos
      let modelSelect = document.getElementById('model-select');
      if (!modelSelect) {
          console.warn('Creando selector de modelos (oculto)...');
          modelSelect = document.createElement('select');
          modelSelect.id = 'model-select';
          modelSelect.className = 'hidden-select';
  
          // Añadir opciones de modelos
          for (const [id, name] of Object.entries(window.app.chat.availableModels || {})) {
              const option = document.createElement('option');
              option.value = id;
              option.textContent = name;
              modelSelect.appendChild(option);
          }
  
          // Seleccionar modelo activo
          modelSelect.value = window.app.chat.activeModel || 'openai';
  
          // Añadir al DOM
          document.body.appendChild(modelSelect);
      }
  
      console.log('Elementos necesarios verificados y creados');
      return true;
  }
  
  /**
   * Intenta obtener una respuesta del endpoint de fallback
   * @param {string} message - Mensaje a enviar
   * @param {string} agentId - ID del agente
   * @param {string} model - Modelo a usar
   */
  function tryFallbackEndpoint(message, agentId, model) {
      console.log("Intentando con endpoint de fallback...");
      addSystemMessage("Intentando con servidor alternativo...");
      
      // Verificar que el endpoint de fallback esté configurado
      const fallbackEndpoint = window.app.chat.apiEndpoints?.fallback || '/api/generate';
      
      // Mostrar indicador de carga
      const loadingId = showLoadingIndicator();
      
      fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-Client-ID': window.app.chat.clientId || 'unknown',
              'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
          },
          body: JSON.stringify({
              message: message,
              agent_id: agentId,
              model: model,
              is_fallback: true,
              timestamp: new Date().toISOString()
          }),
      })
      .then(response => {
          if (!response.ok) {
              throw new Error(`Error del servidor alternativo: ${response.status} ${response.statusText}`);
          }
          return response.json();
      })
      .then(data => {
          // Eliminar indicador de carga
          removeLoadingIndicator(loadingId);
          
          if (data.response || data.message) {
              const responseText = data.response || data.message;
              
              // Verificar si es una respuesta simulada
              if (responseText.includes("Esta es una respuesta simulada") || 
                  responseText.includes("En un entorno real, esto sería reemplazado")) {
                  console.error("Se detectó una respuesta simulada en el fallback");
                  addSystemMessage("Error: No se pudo obtener una respuesta real. Verifica la configuración de las APIs en el servidor.");
                  return;
              }
              
              addRealAgentMessage(responseText, agentId);
              
              // Guardar en el contexto
              if (window.app.chat.context) {
                  window.app.chat.context.push({ role: 'assistant', content: responseText });
                  
                  // Limitar el contexto a los últimos 10 mensajes
                  if (window.app.chat.context.length > 10) {
                      window.app.chat.context = window.app.chat.context.slice(-10);
                  }
              }
          } else {
              addSystemMessage("No se pudo obtener respuesta del servidor alternativo");
          }
      })
      .catch(fallbackError => {
          // Eliminar indicador de carga
          removeLoadingIndicator(loadingId);
          
          console.error('Error en servidor alternativo:', fallbackError);
          addSystemMessage("Error en servidor alternativo. Por favor, verifica la configuración de las APIs en el servidor.");
      });
  }
  
  /**
   * Genera un ID de cliente único
   * @returns {string} - ID de cliente
   */
  function generateClientId() {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      window.app.chat.clientId = clientId;
      return clientId;
  }
  
  /**
   * Inicializa el chat cuando el DOM está listo
   */
  document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM cargado, inicializando chat...');
  
      // Verificar y crear elementos necesarios si no existen
      ensureRequiredElements();
  
      // Inicializar el chat
      if (typeof window.initializeChat === 'function') {
          window.initializeChat();
      } else {
          console.error('Chat no inicializado correctamente, reiniciando...');
  
          // Reinicializar estructuras básicas
          window.app = window.app || {};
          window.app.chat = window.app.chat || {};
          window.app.chat.context = [];
          window.app.chat.chatMessageId = 0;
          window.app.chat.activeModel = 'openai';
          window.app.chat.activeAgent = 'general';
  
          // Configurar elementos de la UI
          setupUIElements();
  
          // Inicializar funcionalidades de UI
          initializeUIFeatures();
  
          // Configurar eventos para el selector de agentes
          setupAgentSelector();
      }
  
      // Configurar evento para el botón de enviar al agente
      const sendToAgentBtn = document.getElementById('send-to-agent');
      if (sendToAgentBtn) {
          sendToAgentBtn.addEventListener('click', sendToAgent);
      }
  
      // Configurar evento para el selector de agente
      const agentSelect = document.getElementById('agent-select');
      if (agentSelect) {
          agentSelect.addEventListener('change', function() {
              changeAgent(this.value);
          });
  
          // Inicializar con el agente actual
          if (window.app.chat.activeAgent) {
              agentSelect.value = window.app.chat.activeAgent;
          }
      }
  
      // Configurar evento para el selector de modelo
      const modelSelect = document.getElementById('model-select');
      if (modelSelect) {
          modelSelect.addEventListener('change', function() {
              const selectedModel = this.value;
              window.app.chat.activeModel = selectedModel;
  
              // Añadir mensaje de sistema
              const modelName = window.app.chat.availableModels[selectedModel] || selectedModel;
              addSystemMessage(`Modelo cambiado a: ${modelName}`);
  
              // Notificar al usuario
              showNotification(`Modelo cambiado a: ${modelName}`);
          });
      }
  
      // Notificar que el chat está listo
      console.log('Chat inicializado y listo para usar');
  });
  
  // Exponer funciones globalmente
  window.app.chat.sendMessage = sendMessage;
  window.app.chat.addUserMessage = addUserMessage;
  window.app.chat.addAgentMessage = addAgentMessage;
  window.app.chat.addSystemMessage = addSystemMessage;
  window.app.chat.changeAgent = changeAgent;
  window.app.chat.sendToAgent = sendToAgent;
  window.app.chat.copyToClipboard = copyToClipboard;
  

