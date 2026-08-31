import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const rootEl=document.getElementById('root')!;

function fatal(error:unknown){
  const message=error instanceof Error?`${error.name}: ${error.message}`:String(error);
  rootEl.innerHTML=`<main dir="rtl" style="min-height:100vh;display:grid;place-items:center;background:#f5f7fb;padding:24px;font-family:system-ui,sans-serif"><section style="max-width:680px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 14px 45px rgba(15,31,61,.08)"><h1 style="margin:0 0 10px;color:#0f1f3d">تعذر تشغيل ScholarMCP</h1><p style="color:#64748b;line-height:1.8">صار خطأ أثناء تشغيل الواجهة. حدّث الصفحة مرة واحدة، وإذا بقي الخطأ انسخ النص أدناه.</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#0f172a;color:#e2e8f0;padding:16px;border-radius:14px;font-size:13px">${message.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))}</pre><button onclick="location.reload()" style="border:0;background:#2563eb;color:white;padding:12px 18px;border-radius:12px;font-weight:700">إعادة التحميل</button></section></main>`;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, {error:Error|null}>{
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return {error}}
  componentDidCatch(error:Error){console.error('ScholarMCP render error',error)}
  render(){if(this.state.error){queueMicrotask(()=>fatal(this.state.error));return null}return this.props.children}
}

window.addEventListener('unhandledrejection',event=>console.error('ScholarMCP unhandled rejection',event.reason));

import('./App')
  .then(({default:App})=>ReactDOM.createRoot(rootEl).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>))
  .catch(fatal);
