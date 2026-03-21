export default function Section({ children, mt }) {
    return (
        <div className="section-label" style={{ marginTop: mt || '1.75rem' }}>
            {children}
        </div>
    );
}
