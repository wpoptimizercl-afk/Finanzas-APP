import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Zap, FileUp } from 'lucide-react';

/**
 * FABMenu — Speed dial flotante con hide-on-scroll.
 *
 * Props:
 *   onQuickExpense      () => void  — abre modal de gasto rápido
 *   onUploadStatement   () => void  — navega a la página de upload
 *   disabled            boolean     — bloquea interacción (ej: upload en progreso)
 */
export default function FABMenu({ onQuickExpense, onUploadStatement, disabled = false }) {
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    // Ocultar al hacer scroll down, mostrar al hacer scroll up
    useEffect(() => {
        const handleScroll = () => {
            if (ticking.current) return;
            ticking.current = true;
            requestAnimationFrame(() => {
                const currentY = window.scrollY;
                if (currentY > lastScrollY.current + 8) {
                    setVisible(false);
                    setOpen(false);
                } else if (currentY < lastScrollY.current - 5) {
                    setVisible(true);
                }
                lastScrollY.current = currentY;
                ticking.current = false;
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Cerrar con Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const handleQuickExpense = useCallback(() => {
        setOpen(false);
        onQuickExpense();
    }, [onQuickExpense]);

    const handleUpload = useCallback(() => {
        setOpen(false);
        onUploadStatement();
    }, [onUploadStatement]);

    return (
        <>
            {/* Backdrop transparente — cierra el menú al tocar fuera */}
            {open && (
                <div
                    className="fab-menu__backdrop"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className={`fab-menu${visible ? '' : ' fab-menu--hidden'}`}>
                {/* Acciones del speed dial */}
                <div
                    className={`fab-menu__actions${open ? ' fab-menu__actions--open' : ''}`}
                    role="menu"
                    aria-hidden={!open}
                >
                    <button
                        className="fab-menu__action"
                        onClick={handleUpload}
                        disabled={disabled}
                        tabIndex={open ? 0 : -1}
                        role="menuitem"
                        aria-label="Subir estado de cuenta"
                    >
                        <FileUp size={16} strokeWidth={2} />
                        <span>Subir estado de cuenta</span>
                    </button>
                    <button
                        className="fab-menu__action"
                        onClick={handleQuickExpense}
                        tabIndex={open ? 0 : -1}
                        role="menuitem"
                        aria-label="Registrar gasto rápido"
                    >
                        <Zap size={16} strokeWidth={2} />
                        <span>Gasto rápido</span>
                    </button>
                </div>

                {/* Botón principal FAB */}
                <button
                    className="fab"
                    onClick={() => !disabled && setOpen(prev => !prev)}
                    disabled={disabled}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label={open ? 'Cerrar menú de acciones' : 'Acciones rápidas'}
                    title={open ? 'Cerrar' : 'Acciones rápidas'}
                >
                    <Plus
                        size={24}
                        strokeWidth={2.5}
                        style={{
                            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                    />
                </button>
            </div>
        </>
    );
}
