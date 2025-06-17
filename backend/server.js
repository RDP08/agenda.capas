// server.js (en la carpeta backend/)

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises; // Para leer/escribir archivos de forma asíncrona
const path = require('path'); // Para manejar rutas de archivos

const app = express();
const PORT = 3001; // Puerto para el backend (diferente de Live Server 5500)
const DATA_FILE = path.join(__dirname, 'contacts.json');

// Middleware para habilitar CORS
// Esto permitirá que tu frontend (http://127.0.0.1:5500) se conecte a este backend.
app.use(cors({
    origin: 'http://127.0.0.1:5500' // Permite solicitudes solo desde tu Live Server
}));

// Middleware para parsear cuerpos de solicitud JSON
app.use(express.json());

// --- Funciones para manejar los datos ---

// Leer contactos del archivo JSON
async function readContacts() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si el archivo no existe o está vacío, retorna un array vacío
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            return [];
        }
        throw error; // Propaga otros errores
    }
}

// Escribir contactos en el archivo JSON
async function writeContacts(contacts) {
    await fs.writeFile(DATA_FILE, JSON.stringify(contacts, null, 2), 'utf8');
}

// --- Rutas de la API ---

// Ruta GET /api/contacts - Obtener todos los contactos
app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await readContacts();
        res.json(contacts);
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener contactos.' });
    }
});

// Ruta POST /api/contacts - Agregar un nuevo contacto
app.post('/api/contacts', async (req, res) => {
    try {
        const newContact = req.body;

        // Validación básica (puedes añadir más si quieres)
        if (!newContact.nombre || !newContact.apellido || !newContact.telefono) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, apellido o telefono.' });
        }

        const contacts = await readContacts();
        
        // Simular un ID simple para el nuevo contacto
        newContact.id = Date.now().toString(); // Un ID único basado en la marca de tiempo

        contacts.push(newContact);
        await writeContacts(contacts);
        
        // La API original de Raydelto devolvía un texto, así que para simularla, devolvemos un mensaje de éxito.
        // Si tu frontend espera el objeto del nuevo contacto, puedes cambiar `send` por `json(newContact)`
        res.status(201).send('Contacto agregado exitosamente'); 

    } catch (error) {
        console.error('Error al agregar contacto:', error);
        res.status(500).json({ message: 'Error interno del servidor al agregar contacto.' });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Backend de la Agenda ejecutándose en http://localhost:${PORT}`);
    console.log(`✨ Tu frontend debe apuntar a http://localhost:${PORT}/api/contacts`);
});