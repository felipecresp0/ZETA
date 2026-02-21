// test-chat.js — Ejecutar con: node test-chat.js
// Simula dos usuarios chateando en tiempo real

const { io } = require('socket.io-client');

// === TOKENS (pega los tuyos actuales) ===
const TOKEN_SERGIO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNGY4YTEzOC1iMmNjLTQyZTctYTgzZi0wNGFjNjU3YzllOGEiLCJlbWFpbCI6ImEyODYwMkBzdmFsZXJvLmNvbSIsImlhdCI6MTc3MTUzNDIzOCwiZXhwIjoxNzcyMTM5MDM4fQ.Q6v_SqqHf2ZmU6jtcHURp_F7yqvT5_0vL5bVFFH4ToU';

const TOKEN_FELIPE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZjU0MTc3MC0wNjFhLTRiMWQtOWY4NC0zMmQ3OGE1ODJmMzAiLCJlbWFpbCI6ImExMjM0NUBzdmFsZXJvLmNvbSIsImlhdCI6MTc3MTUzNDczNiwiZXhwIjoxNzcyMTM5NTM2fQ.scamgX25QLUvPRFpMZU0huWWaGPR9uQ_3rCQlVjIxWM';

// ID de la conversación directa entre Sergio y Felipe
const CONV_ID = '4d884366-4b21-4410-bc8c-61f9e524c6ad';

// === Conectar como Sergio ===
const sergio = io('http://localhost:3000/chat', {
    auth: { token: TOKEN_SERGIO },
});

// === Conectar como Felipe ===
const felipe = io('http://localhost:3000/chat', {
    auth: { token: TOKEN_FELIPE },
});

// ── Sergio: listeners ──
sergio.on('connect', () => {
    console.log('✅ Sergio conectado');
});

sergio.on('message:new', (msg) => {
    console.log(`📨 Sergio recibe: [${msg.sender_name}]: ${msg.content}`);
});

sergio.on('typing:update', (data) => {
    if (data.is_typing) {
        console.log('✍️  Sergio ve: alguien está escribiendo...');
    }
});

sergio.on('messages:read', (data) => {
    console.log('👀 Sergio ve: mensajes leídos por', data.read_by);
});

// ── Felipe: listeners ──
felipe.on('connect', () => {
    console.log('✅ Felipe conectado');

    // Simular flujo de chat después de 1 segundo
    setTimeout(() => {
        console.log('\n--- SIMULACIÓN DE CHAT ---\n');

        // 1. Sergio envía mensaje
        console.log('📤 Sergio envía: "Ey Felipe, has visto el proyecto de BD?"');
        sergio.emit('message:send', {
            conversation_id: CONV_ID,
            content: 'Ey Felipe, has visto el proyecto de BD?',
        });
    }, 1000);
});

felipe.on('message:new', (msg) => {
    console.log(`📨 Felipe recibe: [${msg.sender_name}]: ${msg.content}`);

    // Si Felipe recibe el primer mensaje, responder
    if (msg.content.includes('proyecto de BD')) {
        // Felipe empieza a escribir
        setTimeout(() => {
            console.log('📤 Felipe emite: typing:start');
            felipe.emit('typing:start', { conversation_id: CONV_ID });
        }, 500);

        // Felipe responde después de 2 segundos
        setTimeout(() => {
            felipe.emit('typing:stop', { conversation_id: CONV_ID });
            console.log('📤 Felipe envía: "Sí tío, lo tengo casi listo"');
            felipe.emit('message:send', {
                conversation_id: CONV_ID,
                content: 'Sí tío, lo tengo casi listo',
            });
        }, 2000);

        // Felipe marca como leído
        setTimeout(() => {
            console.log('📤 Felipe marca como leído');
            felipe.emit('messages:read', { conversation_id: CONV_ID });
        }, 2500);
    }

    // Si es la respuesta de Felipe, verificar mensajes vía REST y cerrar
    if (msg.content.includes('casi listo')) {
        setTimeout(() => {
            console.log('\n--- FIN DEL TEST ---');
            console.log('✅ Chat en tiempo real funcionando correctamente');
            sergio.disconnect();
            felipe.disconnect();
            process.exit(0);
        }, 2000);
    }
});

felipe.on('typing:update', (data) => {
    if (data.is_typing) {
        console.log('✍️  Felipe ve: alguien está escribiendo...');
    }
});

// ── Errores ──
sergio.on('connect_error', (err) => console.log('❌ Sergio error:', err.message));
felipe.on('connect_error', (err) => console.log('❌ Felipe error:', err.message));
sergio.on('message:error', (err) => console.log('❌ Sergio msg error:', err));
felipe.on('message:error', (err) => console.log('❌ Felipe msg error:', err));