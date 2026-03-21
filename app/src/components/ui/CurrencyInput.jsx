import { useState } from 'react';

export default function CurrencyInput({ value, onChange, onSave, defaultValue, large }) {
    const [focused, setFocused] = useState(false);
    const formatted = value ? '$' + Number(value).toLocaleString('es-CL') : '';
    const placeholder = '$' + Number(defaultValue || 0).toLocaleString('es-CL');

    const handleChange = e => {
        const clean = e.target.value.replace(/\$/g, '').replace(/\./g, '').replace(/[^\d-]/g, '');
        onChange(clean);
    };
    const handlePaste = e => {
        e.preventDefault();
        const clean = e.clipboardData.getData('text').replace(/\$/g, '').replace(/\./g, '').replace(/[^\d-]/g, '');
        onChange(clean);
    };

    return (
        <input
            type={focused ? 'number' : 'text'}
            value={focused ? value : formatted}
            placeholder={focused ? String(defaultValue || '') : placeholder}
            onChange={handleChange}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter' && onSave) onSave(); }}
            style={{
                flex: 1, minWidth: 0, padding: 0,
                fontSize: large ? '28px' : '15px',
                fontWeight: large ? 700 : 500,
                background: 'transparent', border: 'none', outline: 'none',
                color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                letterSpacing: large ? '-.5px' : '0',
                fontFamily: 'var(--font-sans)',
            }}
        />
    );
}
