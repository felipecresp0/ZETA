// =============================================
// src/modules/chat/schemas/typing-indicator.schema.ts
// Cache de "usuario está escribiendo..." (TTL automático)
// =============================================

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TypingIndicatorDocument = TypingIndicator & Document;

@Schema({
    timestamps: true,
    collection: 'typing_indicators',
})
export class TypingIndicator {
    @Prop({ required: true })
    conversation_id: string;

    @Prop({ required: true })
    user_id: string;

    @Prop({ required: true })
    user_name: string;           // Para mostrar "Ana está escribiendo..."

    // Este documento se auto-elimina a los 5 segundos
    @Prop({ default: Date.now, expires: 5 })
    created_at: Date;
}

export const TypingIndicatorSchema = SchemaFactory.createForClass(TypingIndicator);
TypingIndicatorSchema.index({ conversation_id: 1 });