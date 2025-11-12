import { useEffect, useState } from 'react';
import { usePuterStore } from '~/lib/puter';

interface SecurityLog {
    timestamp: string;
    confidence: number;
    patterns: string[];
    input: string;
}

const SecurityLogs = () => {
    const { kv } = usePuterStore();
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const keys = await kv.list('security:injection:*', true);
            const logData: SecurityLog[] = [];

            if (keys) {
                for (const key of keys) {
                    const value = await kv.get(key as string);
                    if (value) {
                        logData.push(JSON.parse(value));
                    }
                }
            }

            // Sort by timestamp descending (newest first)
            logData.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setLogs(logData);
        } catch (error) {
            console.error('Failed to load security logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearLogs = async () => {
        try {
            const keys = await kv.list('security:injection:*', true);
            if (keys) {
                for (const key of keys) {
                    await kv.delete(key as string);
                }
            }
            setLogs([]);
        } catch (error) {
            console.error('Failed to clear logs:', error);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 my-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-red-600">
                    🛡️ Security Logs - Injection Attempts
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={loadLogs}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                        {isLoading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button
                        onClick={clearLogs}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                    No security incidents detected. Click "Refresh" to check.
                </p>
            ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {logs.map((log, index) => (
                        <div
                            key={index}
                            className={`border-l-4 p-4 rounded ${log.confidence >= 0.7
                                    ? 'border-red-500 bg-red-50'
                                    : log.confidence >= 0.4
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-yellow-500 bg-yellow-50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-semibold text-sm text-gray-600">
                                    {new Date(log.timestamp).toLocaleString()}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.confidence >= 0.7
                                        ? 'bg-red-200 text-red-800'
                                        : log.confidence >= 0.4
                                            ? 'bg-orange-200 text-orange-800'
                                            : 'bg-yellow-200 text-yellow-800'
                                    }`}>
                                    {(log.confidence * 100).toFixed(0)}% Confidence
                                </span>
                            </div>

                            <div className="mb-2">
                                <p className="text-sm font-semibold text-gray-700">Detected Patterns:</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {log.patterns.map((pattern, i) => (
                                        <code
                                            key={i}
                                            className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs"
                                        >
                                            {pattern.slice(0, 50)}
                                        </code>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700">Input Sample:</p>
                                <p className="text-sm text-gray-600 bg-white p-2 rounded mt-1 font-mono">
                                    {log.input}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SecurityLogs;
