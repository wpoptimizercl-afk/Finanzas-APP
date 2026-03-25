import React, { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { useFinanceData } from './hooks/useFinanceData';
// Layout
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import Topbar from './components/layout/Topbar';
// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import HomePage from './pages/Home';
import UploadPage from './pages/Upload';
import ManualAdjustmentsPage from './pages/ManualAdjustments';
import HistoryPage from './pages/History';
import BudgetPage from './pages/Budget';
import ConfigPage from './pages/Config';
import OnboardingPage from './pages/Onboarding';
// Styles
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';

function AppInner() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState('dashboard');

  const {
    months, sorted, uniqueSortedPeriods, accounts,
    fixedByMonth, incomeByMonth, extraByMonth,
    budget, catRules, customCats, allCats, ready,
    saveMonth, deleteMonth, saveAccount, updateAccount,
    saveFixedItems, saveIncome, saveExtraItems,
    saveIncomeCategory, deleteIncomeCategory, saveIncomeItems, incomeCategories,
    saveBudget, saveCustomCat, deleteCustomCat, recategorizeMonth,
    saveCatRule, deleteCatRule,
  } = useFinanceData();

  const defaultIncome = budget.income || 0;

  // Wrappers with toast feedback
  const handleSaveMonth = useCallback(async (data) => {
    await saveMonth(data);
    toast('Mes guardado correctamente', 'success');
  }, [saveMonth, toast]);

  const handleDeleteMonth = useCallback(async (periodo, monthId = null) => {
    await deleteMonth(periodo, monthId);
    toast(`${periodo} eliminado`, 'default');
  }, [deleteMonth, toast]);

  const handleSaveFixed = useCallback(async (periodo, items) => {
    await saveFixedItems(periodo, items);
    toast('Gastos fijos guardados', 'success');
  }, [saveFixedItems, toast]);

  const handleSaveIncome = useCallback(async (periodo, amount) => {
    await saveIncome(periodo, amount);
    toast('Ingreso guardado', 'success');
  }, [saveIncome, toast]);

  const handleSaveExtra = useCallback(async (periodo, items) => {
    await saveExtraItems(periodo, items);
    toast('Ingresos extra guardados', 'success');
  }, [saveExtraItems, toast]);

  const handleSaveBudget = useCallback(async (data) => {
    await saveBudget(data);
    toast('Presupuesto guardado', 'success');
  }, [saveBudget, toast]);

  const handleSaveCat = useCallback(async (id, data) => {
    await saveCustomCat(id, data);
    toast('Categoría guardada', 'success');
  }, [saveCustomCat, toast]);

  const handleDeleteCat = useCallback(async (id) => {
    await deleteCustomCat(id);
    toast('Categoría eliminada', 'default');
  }, [deleteCustomCat, toast]);

  const handleSaveAccount = useCallback(async (data) => {
    const saved = await saveAccount(data);
    toast('Cuenta guardada', 'success');
    return saved;
  }, [saveAccount, toast]);

  const handleUpdateAccount = useCallback(async (id, data) => {
    const updated = await updateAccount(id, data);
    toast('Cuenta actualizada', 'success');
    return updated;
  }, [updateAccount, toast]);

  const handleSaveIncomeItems = useCallback(async (periodo, items) => {
    await saveIncomeItems(periodo, items);
    toast(`${items.length} ingreso${items.length > 1 ? 's' : ''} registrado${items.length > 1 ? 's' : ''}`, 'success');
  }, [saveIncomeItems, toast]);

  const handleSaveIncomeCategory = useCallback(async (data) => {
    await saveIncomeCategory(data);
    toast('Categoría de ingreso creada', 'success');
  }, [saveIncomeCategory, toast]);

  // Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-medium)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando…</span>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  const navProps = { view, onNav: setView };
  const commonDataProps = { months: sorted, allMonths: sorted, uniqueSortedPeriods, accounts, fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, budget, allCats };

  const renderPage = () => {
    if (!ready) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '2.5px solid var(--border-medium)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando datos…</span>
      </div>
    );

    if (accounts.length === 0) return (
      <OnboardingPage
        onSaveAccount={handleSaveAccount}
        onGoUpload={() => setView('upload')}
      />
    );

    switch (view) {
      case 'dashboard': return (
        <DashboardPage {...commonDataProps}
          onGoUpload={() => setView('upload')}
          onGoHistory={(p) => setView('history')}
        />
      );
      case 'home': return (
        <HomePage allMonths={sorted} {...commonDataProps}
          onGoUpload={() => setView('upload')}
        />
      );
      case 'upload': return (
        <UploadPage
          months={sorted} catRules={catRules} allCats={allCats}
          accounts={accounts} incomeCategories={incomeCategories}
          onSaveMonth={handleSaveMonth}
          onSaveAccount={handleSaveAccount}
          onSaveIncome={handleSaveIncome}
          onSaveIncomeItems={handleSaveIncomeItems}
          onSaveIncomeCategory={handleSaveIncomeCategory}
          onGoManual={() => setView('manual')}
        />
      );
      case 'fixed': return (
        <ManualAdjustmentsPage
          fixedByMonth={fixedByMonth} extraByMonth={extraByMonth} allCats={allCats}
          incomeCategories={incomeCategories}
          onSaveFixed={handleSaveFixed} onSaveExtra={handleSaveExtra}
        />
      );
      case 'history': return (
        <HistoryPage
          allMonths={sorted} uniqueSortedPeriods={uniqueSortedPeriods} accounts={accounts}
          allCats={allCats}
          deleteMonth={handleDeleteMonth} recategorizeMonth={recategorizeMonth}
        />
      );
      case 'budget': return (
        <BudgetPage {...commonDataProps}
          onSaveBudget={handleSaveBudget}
        />
      );
      case 'config': return (
        <ConfigPage
          customCats={customCats} catRules={catRules} accounts={accounts}
          incomeCategories={incomeCategories}
          onSaveCat={handleSaveCat} onDeleteCat={handleDeleteCat}
          onSaveAccount={handleSaveAccount}
          onUpdateAccount={handleUpdateAccount}
          onSaveIncomeCategory={handleSaveIncomeCategory}
          onDeleteIncomeCategory={async (id) => { await deleteIncomeCategory(id); toast('Categoría eliminada', 'default'); }}
          onDeleteCatRule={async (key) => { await deleteCatRule(key); toast('Regla eliminada', 'default'); }}
        />
      );
      case 'manual': return (
        <div className="animate-fadeIn">
          <div className="empty-state" style={{ paddingTop: '4rem' }}>
            <div className="empty-state-title">Entrada Manual en Desarrollo</div>
            <div className="empty-state-desc">Esta funcionalidad estará disponible en la próxima actualización.</div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <Sidebar {...navProps} />

      {/* Main content */}
      <div className="app-main">
        {/* Mobile topbar */}
        <Topbar view={view} />

        <main className="page-content">
          {renderPage()}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav {...navProps} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
