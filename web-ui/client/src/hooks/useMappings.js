import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export function useMappings() {
    const [mappings, setMappings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMappings = useCallback(async (force = false) => {
        setIsLoading(true);
        setError(null);
        try {
            const url = force ? `${API_BASE_URL}/mappings?force=true` : `${API_BASE_URL}/mappings`;
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success) {
                const sanitizedMappings = result.data.map((m) => ({
                    shortCode: m.shortCode || '',
                    longUrl: m.longUrl || '',
                    utm_source: m.utm_source || '',
                    utm_medium: m.utm_medium || '',
                    utm_campaign: m.utm_campaign || '',
                    tags: m.tags || [],
                }));
                setMappings(sanitizedMappings);
            } else {
                throw new Error(result.error || 'Failed to fetch mappings.');
            }
        } catch (err) {
            setError(err.message);
            setMappings([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMappings(false);
    }, [fetchMappings]);

    const createMapping = async (formData) => {
        const shortCode = formData.customShortCode || nanoid(6);
        const newMapping = { ...formData, shortCode };

        setMappings((prev) => [...prev, newMapping]);

        try {
            const response = await fetch(`${API_BASE_URL}/mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    shortCode: newMapping.shortCode,
                    longUrl: newMapping.longUrl,
                    utm_source: newMapping.utm_source,
                    utm_medium: newMapping.utm_medium,
                    utm_campaign: newMapping.utm_campaign,
                    tags: newMapping.tags,
                }),
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to create mapping.');
            }
            return { success: true };
        } catch (err) {
            setMappings((prev) => prev.filter((m) => m.shortCode !== shortCode));
            return { success: false, error: err.message };
        }
    };

    const updateMapping = async (formData) => {
        const { shortCode } = formData;
        const originalMappings = mappings;

        setMappings((prev) => prev.map((m) => (m.shortCode === shortCode ? formData : m)));

        try {
            const response = await fetch(`${API_BASE_URL}/mappings/${shortCode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    longUrl: formData.longUrl,
                    utm_source: formData.utm_source,
                    utm_medium: formData.utm_medium,
                    utm_campaign: formData.utm_campaign,
                    tags: formData.tags,
                }),
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to update mapping.');
            }
            return { success: true };
        } catch (err) {
            setMappings(originalMappings);
            return { success: false, error: err.message };
        }
    };

    const deleteMapping = async (shortCode) => {
        const originalMappings = mappings;
        setMappings((prev) => prev.filter((m) => m.shortCode !== shortCode));

        try {
            const response = await fetch(`${API_BASE_URL}/mappings/${shortCode}`, { method: 'DELETE', credentials: 'include' });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to delete mapping.');
            }
            return { success: true };
        } catch (err) {
            setMappings(originalMappings);
            return { success: false, error: err.message };
        }
    };

    return { mappings, isLoading, error, fetchMappings, createMapping, updateMapping, deleteMapping };
}
