export default function Modal({ title, desc, onConfirm, onCancel, confirmLabel = 'Confirmar', confirmClass = 'btn-danger', children }) {
    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                {title && <div className="modal-title">{title}</div>}
                {desc && <div className="modal-desc">{desc}</div>}
                {children}
                {(onConfirm || onCancel) && (
                    <div className="modal-actions">
                        {onConfirm && (
                            <button className={`btn ${confirmClass}`} style={{ flex: 1 }} onClick={onConfirm}>
                                {confirmLabel}
                            </button>
                        )}
                        {onCancel && (
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
                                Cancelar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
