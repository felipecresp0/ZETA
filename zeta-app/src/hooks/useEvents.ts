// =============================================
// src/hooks/useEvents.ts
// Hook que carga eventos y los agrupa por fecha
// para alimentar el calendario con "marked dates"
// =============================================
import { useState, useEffect, useCallback } from 'react';
import eventsService, { ZetaEvent } from '../services/eventsService';

/** Formato "YYYY-MM-DD" que react-native-calendars espera */
const toDateKey = (iso: string) => iso.slice(0, 10);

export interface DayEvents {
    [dateKey: string]: ZetaEvent[];
}

export interface MarkedDates {
    [dateKey: string]: {
        marked: boolean;
        dotColor: string;
        dots?: { key: string; color: string }[];
    };
}

export function useEvents() {
    const [events, setEvents] = useState<ZetaEvent[]>([]);
    const [byDate, setByDate] = useState<DayEvents>({});
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await eventsService.getUpcoming();
            setEvents(data);

            // Agrupar por fecha
            const grouped: DayEvents = {};
            const marks: MarkedDates = {};

            data.forEach((ev) => {
                const key = toDateKey(ev.event_date);
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(ev);
                marks[key] = { marked: true, dotColor: '#0298D1' };
            });

            setByDate(grouped);
            setMarkedDates(marks);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Error cargando eventos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { events, byDate, markedDates, loading, error, refresh: fetch };
}