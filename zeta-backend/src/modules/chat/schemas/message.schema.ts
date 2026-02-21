
// =============================================
// src/modules/chat/schemas/message.schema.ts
// Cada documento = 1 mensaje en MongoDB
// =============================================
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({
    timestamps: true,            // createdAt + updatedAt automáticos
    collection: 'messages',
})
export class Message {
    // ID de la conversación en PostgreSQL (el nexo entre ambas DBs)
    @Prop({ required: true, index: true })
    conversation_id: string;

    // UUID del usuario que envía (referencia a users.id en PostgreSQL)
    @Prop({ required: true })
    sender_id: string;

    // Contenido del mensaje
    @Prop({ required: true })
    content: string;

    // Tipo de contenido para futuras extensiones
    @Prop({ default: 'text' })
    type: string;                // text | image | file | system

    // URL del archivo adjunto (si aplica)
    @Prop({ default: null })
    attachment_url: string;

    // Estado de lectura por usuario: { "user-uuid-1": true, "user-uuid-2": false }
    // Esto evita una tabla/colección separada de read_receipts
    @Prop({ type: Map, of: Boolean, default: {} })
    read_by: Map<string, boolean>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// ── Índices para queries rápidas ──
// Obtener mensajes de una conversación ordenados por fecha (el query más común)
MessageSchema.index({ conversation_id: 1, createdAt: -1 });

// Buscar mensajes no leídos por un usuario específico
MessageSchema.index({ conversation_id: 1, [`read_by.$**`]: 1 });
