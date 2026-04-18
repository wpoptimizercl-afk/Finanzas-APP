import { useAuth } from '../context/AuthContext';

const FEATURES = [
    { text: 'Dashboard con métricas en tiempo real' },
    { text: 'Procesa estados de cuenta con IA' },
    { text: 'Datos seguros con autenticación Google' },
];

export default function LoginPage() {
    const { signInWithGoogle } = useAuth();

    return (
        <div className="login-page">
            <div className="login-card animate-fadeIn">
                <div className="login-logo" style={{ marginBottom: 40 }}>
                    <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, letterSpacing: '.08em', fontSize: 18, textTransform: 'uppercase' }}>
                        <div style={{ width: 22, height: 22, background: 'var(--olive)', borderRadius: '50%', display: 'inline-block', position: 'relative', boxShadow: 'inset 2px -2px 0 rgba(0,0,0,.18)' }}>
                            <div style={{ position: 'absolute', top: 5, left: 6, width: 4, height: 4, background: 'rgba(255,255,255,.35)', borderRadius: '50%' }} />
                        </div>
                        <span>App6tuna</span>
                    </div>
                </div>

                <h1 className="login-title">Controla tus finanzas</h1>
                <p className="login-subtitle">
                    Organiza tus gastos, analiza tus hábitos financieros<br />
                    y alcanza tus metas de ahorro.
                </p>

                <button className="login-btn-google" onClick={signInWithGoogle}>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuar con Google
                </button>

                <div className="login-features">
                    {FEATURES.map(({ text }) => (
                        <div key={text} className="login-feature">
                            <span className="login-feature-dot" />
                            {text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
