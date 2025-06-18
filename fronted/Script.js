/**
 * AGENDA WEB - GESTOR DE CONTACTOS
 * Script principal para la gestión de contactos
 */

// Configuración de la API
const API_URL = 'http://www.raydelto.org/agenda.php';

// Proxy CORS alternatives (descomenta una de estas opciones si tienes problemas de CORS)
// const API_URL = 'https://cors-anywhere.herokuapp.com/http://www.raydelto.org/agenda.php';
// const API_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('http://www.raydelto.org/agenda.php');
// const API_URL = 'https://corsproxy.io/?' + encodeURIComponent('http://www.raydelto.org/agenda.php');

// Variables globales
let contacts = [];
let isLoading = false;

// Elementos del DOM (se inicializarán cuando el DOM esté listo)
let contactForm = null;
let contactsContainer = null;
let messageContainer = null;
let refreshBtn = null;
let contactCount = null;

/**
 * CLASE PRINCIPAL - AGENDA
 */
class Agenda {
    constructor() {
        this.contacts = [];
        this.initializeEventListeners();
        this.loadContacts();
        this.setupAutoRefresh();
    }

    /**
     * Inicializa los event listeners
     */
    initializeEventListeners() {
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshContacts());
        }
        
        // Validación en tiempo real
        if (contactForm) {
            const inputs = contactForm.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', () => this.clearMessages());
            });
        }
    }

    /**
     * Configura el auto-refresh cada 30 segundos
     */
    setupAutoRefresh() {
        setInterval(() => {
            if (!isLoading) {
                this.loadContacts(true); // true = silent refresh
            }
        }, 30000);
    }

    /**
     * Limpia los mensajes de error/éxito
     */
    clearMessages() {
        MessageHandler.clear();
    }

    /**
     * Maneja el envío del formulario
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (isLoading || !contactForm) return;
        
        const formData = new FormData(contactForm);
        const contactData = {
            nombre: (formData.get('nombre') || '').trim(),
            apellido: (formData.get('apellido') || '').trim(),
            telefono: (formData.get('telefono') || '').trim()
        };

        // Validación
        const validation = Validator.validateContact(contactData);
        if (!validation.isValid) {
            MessageHandler.showError(validation.errors.join('<br>'));
            return;
        }

        // Sanitizar datos
        contactData.nombre = Validator.sanitizeText(contactData.nombre);
        contactData.apellido = Validator.sanitizeText(contactData.apellido);
        contactData.telefono = contactData.telefono.replace(/\D/g, '');

        // Deshabilitar formulario durante el envío
        this.toggleFormState(true);

        try {
            await this.addContact(contactData);
        } finally {
            this.toggleFormState(false);
        }
    }

    /**
     * Habilita/deshabilita el formulario
     */
    toggleFormState(disabled) {
        if (!contactForm) return;
        
        const inputs = contactForm.querySelectorAll('input, button');
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        
        inputs.forEach(input => {
            input.disabled = disabled;
        });
        
        if (submitBtn) {
            submitBtn.textContent = disabled ? 'Guardando...' : 'Guardar Contacto';
            submitBtn.disabled = disabled;
        }
    }

    /**
     * Refresh manual de contactos
     */
    async refreshContacts() {
        MessageHandler.showInfo('Actualizando contactos...');
        await this.loadContacts();
    }

    /**
     * Carga los contactos desde la API
     */
    async loadContacts(silent = false) {
        if (isLoading) return;
        
        isLoading = true;
        
        try {
            if (!silent) {
                UIManager.showLoading();
            }
            
            const response = await fetch(API_URL, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            
            // Validar que la respuesta sea un array
            if (!Array.isArray(data)) {
                throw new Error('Formato de respuesta inválido');
            }

            this.contacts = data;
            
            UIManager.displayContacts(this.contacts);
            UIManager.updateContactCount(this.contacts.length);
            
            if (!silent && this.contacts.length > 0) {
                MessageHandler.showSuccess(`${this.contacts.length} contactos cargados`);
            }
            
        } catch (error) {
            console.error('Error al cargar contactos:', error);
            
            // Manejo específico de errores CORS
            if (error.name === 'TypeError' || error.message.includes('CORS') || error.message.includes('fetch')) {
                UIManager.showCORSError();
                MessageHandler.showError('Error de CORS. Usa una de las soluciones sugeridas.');
            } else {
                UIManager.showError(`Error al cargar contactos: ${error.message}`);
                MessageHandler.showError(`No se pudieron cargar los contactos: ${error.message}`);
            }
        } finally {
            isLoading = false;
        }
    }

    /**
     * Agrega un nuevo contacto
     */
    async addContact(contactData) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'omit',
                body: JSON.stringify(contactData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const result = await response.text();
            
            // Verificar si la respuesta indica error
            if (result.toLowerCase().includes('error')) {
                throw new Error(result);
            }

            MessageHandler.showSuccess(`Contacto "${contactData.nombre} ${contactData.apellido}" agregado exitosamente`);
            
            if (contactForm) {
                contactForm.reset();
            }
            
            // Recargar la lista después de un breve delay
            setTimeout(() => this.loadContacts(true), 1000);
            
        } catch (error) {
            console.error('Error al agregar contacto:', error);
            
            // Manejo específico de errores CORS
            if (error.name === 'TypeError' || error.message.includes('CORS') || error.message.includes('fetch')) {
                MessageHandler.showError('Error de CORS. Verifica la configuración del servidor o usa un proxy CORS.');
            } else {
                MessageHandler.showError(`Error al agregar contacto: ${error.message}`);
            }
        }
    }

    /**
     * Busca contactos por nombre
     */
    searchContacts(query) {
        if (!query.trim()) {
            UIManager.displayContacts(this.contacts);
            return;
        }

        const filteredContacts = this.contacts.filter(contact => 
            (contact.nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (contact.apellido || '').toLowerCase().includes(query.toLowerCase()) ||
            (contact.telefono || '').includes(query)
        );

        UIManager.displayContacts(filteredContacts);
        UIManager.updateContactCount(filteredContacts.length);
    }
}

/**
 * CLASE PARA MANEJO DE MENSAJES
 */
class MessageHandler {
    static showMessage(message, type = 'info', duration = 5000) {
        if (!messageContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.innerHTML = message;
        
        messageContainer.innerHTML = '';
        messageContainer.appendChild(messageElement);
        
        // Auto-ocultar después del tiempo especificado
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, duration);
    }

    static showSuccess(message) {
        this.showMessage(`✅ ${message}`, 'success');
    }

    static showError(message) {
        this.showMessage(`❌ ${message}`, 'error', 8000);
    }

    static showInfo(message) {
        this.showMessage(`ℹ️ ${message}`, 'info', 3000);
    }

    static showWarning(message) {
        this.showMessage(`⚠️ ${message}`, 'warning');
    }

    static clear() {
        if (messageContainer) {
            messageContainer.innerHTML = '';
        }
    }
}

/**
 * CLASE PARA MANEJO DE LA INTERFAZ
 */
class UIManager {
    /**
     * Muestra el estado de carga
     */
    static showLoading() {
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Cargando contactos...</p>
            </div>
        `;
    }

    /**
     * Muestra error en el contenedor de contactos
     */
    static showError(message) {
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Error al cargar contactos</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="btn btn-retry">
                    🔄 Reintentar
                </button>
            </div>
        `;
    }

    /**
     * Muestra error específico de CORS
     */
    static showCORSError() {
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = `
            <div class="error-state cors-error">
                <div class="error-icon">🚫</div>
                <h3>Error de CORS Detectado</h3>
                <p>No se puede conectar con la API debido a restricciones de CORS.</p>
                
                <div class="cors-solutions">
                    <h4>🔧 Soluciones Rápidas:</h4>
                    <div class="solution-option">
                        <strong>Opción 1: Usar Proxy CORS</strong>
                        <p>Descomenta una de las líneas del proxy en el código JavaScript (líneas 5-7)</p>
                    </div>
                    
                    <div class="solution-option">
                        <strong>Opción 2: Servidor Local</strong>
                        <p>Usa Live Server en VS Code o ejecuta un servidor HTTP local</p>
                    </div>
                    
                    <div class="solution-option">
                        <strong>Opción 3: Extensión de Navegador</strong>
                        <p>Instala "CORS Unblock" o "Disable CORS" (solo para desarrollo)</p>
                    </div>
                    
                    <div class="solution-option">
                        <strong>Opción 4: Chrome con CORS Deshabilitado</strong>
                        <p>Ejecuta Chrome con: <code>--disable-web-security --user-data-dir="[path]"</code></p>
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <button onclick="window.location.reload()" class="btn btn-retry">
                        🔄 Reintentar
                    </button>
                    <button onclick="UIManager.showTestData()" class="btn btn-test" style="margin-left: 10px;">
                        📝 Ver Datos de Prueba
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Muestra datos de prueba para desarrollo
     */
    static showTestData() {
        const testContacts = [
            { nombre: "Juan", apellido: "Pérez", telefono: "8091234567" },
            { nombre: "María", apellido: "González", telefono: "8097654321" },
            { nombre: "Pedro", apellido: "Martínez", telefono: "8095551234" }
        ];
        
        this.displayContacts(testContacts);
        this.updateContactCount(testContacts.length);
        MessageHandler.showWarning("Mostrando datos de prueba. La API real no está disponible debido a CORS.");
    }

    /**
     * Muestra los contactos en la interfaz
     */
    static displayContacts(contacts) {
        if (!contactsContainer) return;
        
        if (contacts.length === 0) {
            this.showEmptyState();
            return;
        }

        const contactsHTML = contacts
            .map((contact, index) => this.createContactCard(contact, index))
            .join('');

        contactsContainer.innerHTML = `
            <div class="contacts-grid">
                ${contactsHTML}
            </div>
        `;
    }

    /**
     * Crea una tarjeta de contacto
     */
    static createContactCard(contact, index) {
        const formattedPhone = Utils.formatPhone(contact.telefono || '');
        const fullName = `${contact.nombre || ''} ${contact.apellido || ''}`.trim();
        
        return `
            <div class="contact-card" style="animation-delay: ${index * 0.1}s">
                <div class="contact-avatar">
                    ${Utils.getInitials(fullName)}
                </div>
                <div class="contact-info">
                    <div class="contact-name" title="${fullName}">
                        ${fullName}
                    </div>
                    <div class="contact-phone" title="${contact.telefono || ''}">
                        📞 ${formattedPhone}
                    </div>
                </div>
                <div class="contact-actions">
                    <button class="btn-call" onclick="Utils.callPhone('${contact.telefono || ''}')" title="Llamar">
                        📞
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Muestra el estado vacío
     */
    static showEmptyState() {
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>No hay contactos</h3>
                <p>Agrega tu primer contacto usando el formulario de arriba</p>
            </div>
        `;
    }

    /**
     * Actualiza el contador de contactos
     */
    static updateContactCount(count) {
        if (!contactCount) return;
        
        contactCount.textContent = `${count} contacto${count !== 1 ? 's' : ''}`;
    }
}

/**
 * CLASE PARA VALIDACIONES
 */
class Validator {
    /**
     * Valida el formato del teléfono
     */
    static isValidPhone(phone) {
        if (!phone) return false;
        const cleanPhone = phone.replace(/\D/g, '');
        return cleanPhone.length >= 7 && cleanPhone.length <= 15;
    }

    /**
     * Valida el nombre (solo letras, espacios y caracteres especiales)
     */
    static isValidName(name) {
        if (!name) return false;
        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
        return nameRegex.test(name) && name.length >= 2 && name.length <= 50;
    }

    /**
     * Limpia y formatea el texto
     */
    static sanitizeText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Valida todos los campos del contacto
     */
    static validateContact(contactData) {
        const errors = [];

        // Validar nombre
        if (!contactData.nombre) {
            errors.push('El nombre es obligatorio');
        } else if (!this.isValidName(contactData.nombre)) {
            errors.push('El nombre debe contener solo letras y tener entre 2 y 50 caracteres');
        }

        // Validar apellido
        if (!contactData.apellido) {
            errors.push('El apellido es obligatorio');
        } else if (!this.isValidName(contactData.apellido)) {
            errors.push('El apellido debe contener solo letras y tener entre 2 y 50 caracteres');
        }

        // Validar teléfono
        if (!contactData.telefono) {
            errors.push('El teléfono es obligatorio');
        } else if (!this.isValidPhone(contactData.telefono)) {
            errors.push('El teléfono debe tener entre 7 y 15 dígitos');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

/**
 * UTILIDADES GENERALES
 */
class Utils {
    /**
     * Debounce function para limitar llamadas
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Formatea el número de teléfono para mostrar
     */
    static formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
        } else {
            return phone;
        }
    }

    /**
     * Obtiene las iniciales de un nombre
     */
    static getInitials(fullName) {
        if (!fullName) return '??';
        return fullName
            .split(' ')
            .map(name => name.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    /**
     * Capitaliza la primera letra de cada palabra
     */
    static capitalizeWords(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );
    }

    /**
     * Inicia una llamada telefónica
     */
    static callPhone(phone) {
        if (phone) {
            window.open(`tel:${phone}`, '_self');
        }
    }

    /**
     * Copia texto al portapapeles
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            MessageHandler.showSuccess('Copiado al portapapeles');
        } catch (err) {
            MessageHandler.showError('No se pudo copiar al portapapeles');
        }
    }
}

/**
 * INICIALIZACIÓN DE LA APLICACIÓN
 */
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar elementos del DOM
    contactForm = document.getElementById('contact-form');
    contactsContainer = document.getElementById('contacts-container');
    messageContainer = document.getElementById('message-container');
    refreshBtn = document.getElementById('refresh-btn');
    contactCount = document.getElementById('contact-count');
    
    // Verificar que existan los elementos necesarios
    if (!contactForm || !contactsContainer) {
        console.error('❌ Elementos del DOM no encontrados. Verifica el HTML.');
        return;
    }

    // Inicializar la aplicación
    const agenda = new Agenda();
    
    // Hacer la instancia global para debugging
    window.agenda = agenda;
    
    // Agregar funcionalidad de búsqueda si existe el input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        const debouncedSearch = Utils.debounce((query) => {
            agenda.searchContacts(query);
        }, 300);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }
    
    console.log('📱 Agenda Web inicializada correctamente');
});

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
    MessageHandler.showError('Ha ocurrido un error inesperado. Por favor, recarga la página.');
});

// Manejo de errores de promesas no capturadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada no manejada:', event.reason);
    MessageHandler.showError('Error de conexión. Verifica tu conexión a internet.');
});

// Manejo de cambios de conectividad
window.addEventListener('online', () => {
    MessageHandler.showSuccess('Conexión restaurada');
    if (window.agenda) {
        window.agenda.loadContacts();
    }
});

window.addEventListener('offline', () => {
    MessageHandler.showWarning('Sin conexión a internet');
});
