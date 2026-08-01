import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import './index.css'

const API_URL = 'http://localhost:3001/api'

const initialKiosk = {
  cedula: '',
  sede: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  email: '',
  celular: '',
}

function App() {
  const [view, setView] = useState('welcome')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [sedes, setSedes] = useState([])

  const [kiosk, setKiosk] = useState(initialKiosk)
  const [kioskStep, setKioskStep] = useState(1)
  const [kioskRepresentadosCount, setKioskRepresentadosCount] = useState(0)
  const [kioskRepresentados, setKioskRepresentados] = useState([])
  const [kioskPhoto, setKioskPhoto] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  const [adminToken, setAdminToken] = useState(localStorage.getItem('versa_admin_token') || '')
  const [adminUser, setAdminUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [adminTab, setAdminTab] = useState('dashboard')

  const [records, setRecords] = useState([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsPages, setRecordsPages] = useState(1)
  const [recordsLimit, setRecordsLimit] = useState(10)
  const [recordsQuery, setRecordsQuery] = useState('')
  const [recordsSede, setRecordsSede] = useState('')
  const [editRecord, setEditRecord] = useState(null)

  const [posCedula, setPosCedula] = useState('')
  const [posResult, setPosResult] = useState(null)

  const [billingCedula, setBillingCedula] = useState('')
  const [billingResult, setBillingResult] = useState(null)
  const [billingEvents, setBillingEvents] = useState([])

  const authHeaders = useMemo(() => (
    adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
  ), [adminToken])

  const pushMessage = (type, text) => setMessage({ type, text })

  const fetchSedes = async () => {
    const response = await axios.get(`${API_URL}/sedes`)
    const list = response.data.sedes || []
    setSedes(list)
    setKiosk((prev) => ({ ...prev, sede: prev.sede || list[0] || '' }))
  }

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }, [stream])

  const startCamera = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      })
      setStream(media)
      setCameraActive(true)
    } catch (error) {
      pushMessage('error', 'No se pudo activar la cámara. Revisa permisos del navegador.')
    }
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const side = Math.max(600, Math.min(video.videoWidth || 600, video.videoHeight || 600))
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d')

    const sx = Math.max(0, (video.videoWidth - side) / 2)
    const sy = Math.max(0, (video.videoHeight - side) / 2)
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)
    setKioskPhoto(canvas.toDataURL('image/jpeg', 0.9))
    stopCamera()
  }

  useEffect(() => {
    fetchSedes().catch(() => pushMessage('error', 'No se pudo cargar sedes.'))
  }, [])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!adminToken) {
      setAdminUser(null)
      return
    }

    axios.get(`${API_URL}/auth/me`, { headers: authHeaders })
      .then((response) => {
        setAdminUser(response.data.user)
      })
      .catch(() => {
        localStorage.removeItem('versa_admin_token')
        setAdminToken('')
        setAdminUser(null)
      })
  }, [adminToken, authHeaders])

  const updateRepresentadosCount = (value) => {
    const count = Math.max(0, Number.parseInt(value, 10) || 0)
    setKioskRepresentadosCount(count)
    const next = [...kioskRepresentados]
    while (next.length < count) next.push({ nombre: '', fecha_nacimiento: '' })
    while (next.length > count) next.pop()
    setKioskRepresentados(next)
  }

  const kioskStart = async () => {
    if (!kiosk.cedula.trim() || !kiosk.sede) {
      pushMessage('error', 'Debes ingresar cédula y sede.')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/kiosk/register-start`, {
        cedula: kiosk.cedula.trim(),
        sede: kiosk.sede,
      })

      const existing = response.data.data || {}
      setKiosk((prev) => ({
        ...prev,
        nombre: existing.nombre || prev.nombre,
        apellido: existing.apellido || prev.apellido,
        fecha_nacimiento: existing.fecha_nacimiento || prev.fecha_nacimiento,
        email: existing.email || prev.email,
        celular: existing.celular || prev.celular,
      }))
      setKioskStep(2)
      pushMessage('success', 'Identificación validada. Continúa el registro.')
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo iniciar registro.')
    } finally {
      setLoading(false)
    }
  }

  const kioskToStep3 = () => {
    if (!kiosk.nombre.trim() || !kiosk.apellido.trim() || !kiosk.fecha_nacimiento) {
      pushMessage('error', 'Completa nombre, apellido y fecha de nacimiento.')
      return
    }
    setKioskStep(3)
  }

  const kioskToStep4 = () => {
    for (let i = 0; i < kioskRepresentados.length; i += 1) {
      if (!kioskRepresentados[i].nombre.trim() || !kioskRepresentados[i].fecha_nacimiento) {
        pushMessage('error', `Completa el acompañante #${i + 1}.`)
        return
      }
    }
    setKioskStep(4)
    setTimeout(() => startCamera(), 250)
  }

  const submitKiosk = async (skipPhoto = false) => {
    setLoading(true)
    try {
      const payload = {
        ...kiosk,
        cedula: kiosk.cedula.trim(),
        nombre: kiosk.nombre.trim(),
        apellido: kiosk.apellido.trim(),
        email: kiosk.email.trim() || null,
        celular: kiosk.celular.trim() || null,
        representados: kioskRepresentados,
      }

      await axios.post(`${API_URL}/kiosk/register-complete`, payload)

      if (!skipPhoto && kioskPhoto) {
        const blob = await (await fetch(kioskPhoto)).blob()
        const form = new FormData()
        form.append('cedula', kiosk.cedula.trim())
        form.append('foto', blob, `kiosk_${kiosk.cedula.trim()}.jpg`)
        await axios.post(`${API_URL}/kiosk/upload-photo`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      pushMessage('success', 'Registro completado y sincronizado con facturación.')
      setKiosk(initialKiosk)
      setKioskRepresentados([])
      setKioskRepresentadosCount(0)
      setKioskPhoto(null)
      setKioskStep(1)
      setView('welcome')
      stopCamera()
      setTimeout(() => {
        setKiosk((prev) => ({ ...prev, sede: sedes[0] || '' }))
      }, 0)
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo completar el registro.')
    } finally {
      setLoading(false)
    }
  }

  const adminLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginForm)
      localStorage.setItem('versa_admin_token', response.data.token)
      setAdminToken(response.data.token)
      setLoginForm({ username: '', password: '' })
      setView('admin')
      pushMessage('success', 'Acceso administrativo concedido.')
    } catch (error) {
      pushMessage('error', 'Credenciales inválidas.')
    } finally {
      setLoading(false)
    }
  }

  const adminLogout = () => {
    localStorage.removeItem('versa_admin_token')
    setAdminToken('')
    setAdminUser(null)
    setView('welcome')
    setAdminTab('dashboard')
  }

  const fetchRecords = async (page = recordsPage) => {
    if (!adminUser) return
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/admin/records`, {
        headers: authHeaders,
        params: {
          page,
          limit: recordsLimit,
          q: recordsQuery || undefined,
          sede: adminUser.role === 'master' ? (recordsSede || undefined) : undefined,
        },
      })
      setRecords(response.data.records || [])
      setRecordsPage(response.data.page || 1)
      setRecordsPages(response.data.totalPages || 1)
      setRecordsTotal(response.data.total || 0)
    } catch (error) {
      pushMessage('error', 'No se pudieron cargar registros.')
    } finally {
      setLoading(false)
    }
  }

  const exportRecords = async (format, scope) => {
    try {
      const endpoint = format === 'xlsx' ? '/admin/export.xlsx' : '/admin/export'
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: authHeaders,
        responseType: 'blob',
        params: {
          page: recordsPage,
          limit: recordsLimit,
          q: recordsQuery || undefined,
          sede: adminUser?.role === 'master' ? (recordsSede || undefined) : undefined,
          scope,
        },
      })

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `registros_${scope}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      pushMessage('error', 'No se pudo exportar la información.')
    }
  }

  const saveEditRecord = async () => {
    if (!editRecord) return
    setLoading(true)
    try {
      await axios.patch(`${API_URL}/admin/records/${editRecord.id}`, editRecord, { headers: authHeaders })
      pushMessage('success', 'Registro actualizado.')
      setEditRecord(null)
      fetchRecords(recordsPage)
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo guardar cambios.')
    } finally {
      setLoading(false)
    }
  }

  const posLookup = async () => {
    if (!posCedula.trim()) return
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/pos/autocomplete/${posCedula.trim()}`, { headers: authHeaders })
      setPosResult(response.data.data)
    } catch (error) {
      setPosResult(null)
      pushMessage('error', error.response?.data?.error || 'No se encontró cliente para caja.')
    } finally {
      setLoading(false)
    }
  }

  const billingLookup = async () => {
    if (!billingCedula.trim()) return
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/billing/lookup/${billingCedula.trim()}`, { headers: authHeaders })
      setBillingResult(response.data.data)
      const notif = await axios.get(`${API_URL}/billing/notifications`, {
        headers: authHeaders,
        params: { cedula: billingCedula.trim(), page: 1, limit: 8 },
      })
      setBillingEvents(notif.data.notifications || [])
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo consultar facturación.')
    } finally {
      setLoading(false)
    }
  }

  const sendBillingWebhook = async (status) => {
    const cedula = billingResult?.cedula || billingCedula.trim()
    if (!cedula) return
    setLoading(true)
    try {
      await axios.post(`${API_URL}/billing/webhook`, {
        cedula,
        event_type: `payment.${status}`,
        status,
        amount: billingResult?.amount_suggested || 0,
        currency: 'USD',
        provider: 'kiosk-dashboard',
        reference: `POS-${Date.now()}`,
      }, { headers: authHeaders })

      pushMessage('success', `Evento ${status} registrado.`)
      await billingLookup()
    } catch (error) {
      pushMessage('error', 'Error al registrar evento de facturación.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminUser && view === 'admin') {
      fetchRecords(1)
    }
  }, [adminUser, view])

  const renderWelcome = () => (
    <div className='ninja-bg min-h-screen p-6 sm:p-10'>
      <div className='max-w-6xl mx-auto'>
        <div className='animate-float glass rounded-3xl p-8 sm:p-12 mb-8'>
          <p className='tracking-[0.25em] text-cyan-300 text-xs sm:text-sm mb-3'>NINJA PARK DIGITAL EXPERIENCE</p>
          <h1 className='text-4xl sm:text-6xl font-black text-white leading-tight'>
            Registro inteligente,
            <span className='block text-cyan-300'>facturación instantánea.</span>
          </h1>
          <p className='text-slate-200 text-lg sm:text-xl mt-5 max-w-3xl'>
            En menos de 2 minutos el cliente completa su acuerdo, captura fotografía y deja lista la información para caja.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <button
            onClick={() => {
              setView('kiosk')
              setKiosk((prev) => ({ ...prev, sede: prev.sede || sedes[0] || '' }))
            }}
            className='group glass rounded-3xl p-8 text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/30'
          >
            <p className='text-cyan-300 text-sm tracking-widest mb-2'>CLIENTE</p>
            <h2 className='text-3xl font-bold text-white mb-3'>Iniciar Registro</h2>
            <p className='text-slate-200 text-base'>
              Flujo guiado paso a paso con cédula, datos personales, acompañantes y foto en cámara.
            </p>
            <div className='mt-6 inline-flex items-center gap-2 bg-cyan-500 text-slate-900 font-bold px-4 py-2 rounded-xl'>
              Empezar ahora
            </div>
          </button>

          <button
            onClick={() => setView('admin-login')}
            className='group glass-dark rounded-3xl p-8 text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/25'
          >
            <p className='text-indigo-300 text-sm tracking-widest mb-2'>ADMINISTRACIÓN</p>
            <h2 className='text-3xl font-bold text-white mb-3'>Acceso de Sistema</h2>
            <p className='text-slate-200 text-base'>
              Panel maestro por sedes, edición de registros, exportación, búsqueda y seguimiento de facturación.
            </p>
            <div className='mt-6 inline-flex items-center gap-2 bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl'>
              Ingresar como admin
            </div>
          </button>
        </div>
      </div>
    </div>
  )

  const renderKiosk = () => (
    <div className='ninja-bg min-h-screen p-4 sm:p-8'>
      <div className='max-w-3xl mx-auto glass rounded-3xl p-6 sm:p-10'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-3xl sm:text-4xl font-black text-white'>Kiosko Cliente</h2>
          <button onClick={() => { stopCamera(); setView('welcome') }} className='text-white/80 hover:text-white'>Volver</button>
        </div>

        <div className='flex items-center gap-2 mb-8'>
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className='flex items-center gap-2'>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${kioskStep >= step ? 'bg-cyan-400 text-slate-900' : 'bg-white/20 text-white'}`}>
                {step}
              </div>
              {step < 4 && <div className={`w-8 sm:w-12 h-1 rounded ${kioskStep > step ? 'bg-cyan-400' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>

        {kioskStep === 1 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Identificación</h3>
            <input className='k-input' placeholder='Número de cédula' value={kiosk.cedula} onChange={(e) => setKiosk((p) => ({ ...p, cedula: e.target.value.replace(/\D/g, '') }))} />
            <select className='k-input' value={kiosk.sede} onChange={(e) => setKiosk((p) => ({ ...p, sede: e.target.value }))}>
              <option value=''>Selecciona sede</option>
              {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
            </select>
            <button onClick={kioskStart} disabled={loading} className='k-btn-primary w-full'>{loading ? 'Validando...' : 'Continuar'}</button>
          </div>
        )}

        {kioskStep === 2 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Datos del Representante</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <input className='k-input' placeholder='Nombre *' value={kiosk.nombre} onChange={(e) => setKiosk((p) => ({ ...p, nombre: e.target.value }))} />
              <input className='k-input' placeholder='Apellido *' value={kiosk.apellido} onChange={(e) => setKiosk((p) => ({ ...p, apellido: e.target.value }))} />
              <input type='date' className='k-input' value={kiosk.fecha_nacimiento} onChange={(e) => setKiosk((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
              <input type='email' className='k-input' placeholder='Email' value={kiosk.email} onChange={(e) => setKiosk((p) => ({ ...p, email: e.target.value }))} />
              <input className='k-input sm:col-span-2' placeholder='Celular' value={kiosk.celular} onChange={(e) => setKiosk((p) => ({ ...p, celular: e.target.value }))} />
            </div>
            <div className='flex gap-3'>
              <button onClick={() => setKioskStep(1)} className='k-btn-soft flex-1'>Atrás</button>
              <button onClick={kioskToStep3} className='k-btn-primary flex-1'>Siguiente</button>
            </div>
          </div>
        )}

        {kioskStep === 3 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Acompañantes</h3>
            <input type='number' min='0' className='k-input' value={kioskRepresentadosCount} onChange={(e) => updateRepresentadosCount(e.target.value)} />
            {kioskRepresentados.map((rep, index) => (
              <div key={index} className='p-4 rounded-2xl bg-white/10 border border-white/20'>
                <p className='text-white font-semibold mb-2'>Acompañante #{index + 1}</p>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <input
                    className='k-input'
                    placeholder='Nombre'
                    value={rep.nombre}
                    onChange={(e) => {
                      const next = [...kioskRepresentados]
                      next[index].nombre = e.target.value
                      setKioskRepresentados(next)
                    }}
                  />
                  <input
                    type='date'
                    className='k-input'
                    value={rep.fecha_nacimiento}
                    onChange={(e) => {
                      const next = [...kioskRepresentados]
                      next[index].fecha_nacimiento = e.target.value
                      setKioskRepresentados(next)
                    }}
                  />
                </div>
              </div>
            ))}
            <div className='flex gap-3'>
              <button onClick={() => setKioskStep(2)} className='k-btn-soft flex-1'>Atrás</button>
              <button onClick={kioskToStep4} className='k-btn-primary flex-1'>Siguiente: Foto</button>
            </div>
          </div>
        )}

        {kioskStep === 4 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Foto del Representante</h3>
            {!kioskPhoto && (
              <>
                <div className='relative rounded-3xl overflow-hidden border border-white/20 bg-slate-900'>
                  <video ref={videoRef} autoPlay playsInline muted className='w-full aspect-square object-cover' />
                  {!cameraActive && <div className='absolute inset-0 flex items-center justify-center text-white'>Iniciando cámara...</div>}
                </div>
                <button onClick={capturePhoto} disabled={!cameraActive} className='k-btn-primary w-full disabled:opacity-50'>Tomar foto</button>
              </>
            )}

            {kioskPhoto && (
              <>
                <img src={kioskPhoto} alt='captura' className='w-full max-w-md mx-auto rounded-3xl border-4 border-cyan-400/80' />
                <div className='flex gap-3'>
                  <button onClick={() => { setKioskPhoto(null); startCamera() }} className='k-btn-soft flex-1'>Repetir</button>
                  <button onClick={() => submitKiosk(false)} disabled={loading} className='k-btn-primary flex-1'>{loading ? 'Guardando...' : 'Guardar y Finalizar'}</button>
                </div>
              </>
            )}

            <button onClick={() => submitKiosk(true)} disabled={loading} className='text-slate-200 underline w-full'>Omitir foto y finalizar</button>
          </div>
        )}

        {message.text && <p className={`mt-5 text-center ${message.type === 'error' ? 'text-red-300' : 'text-cyan-300'}`}>{message.text}</p>}
      </div>
    </div>
  )

  const renderAdminLogin = () => (
    <div className='ninja-bg min-h-screen p-6 flex items-center justify-center'>
      <div className='glass-dark rounded-3xl p-8 w-full max-w-md'>
        <h2 className='text-3xl font-black text-white mb-2'>Acceso Administrativo</h2>
        <p className='text-slate-300 mb-6'>Control maestro de sedes NINJA PARK</p>

        <form onSubmit={adminLogin} className='space-y-4'>
          <input className='k-input' placeholder='Usuario' value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} />
          <input type='password' className='k-input' placeholder='Contraseña' value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
          <button disabled={loading} className='k-btn-primary w-full'>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>

        <button onClick={() => setView('welcome')} className='mt-5 text-slate-300 underline'>Volver al inicio</button>
      </div>
    </div>
  )

  const renderAdmin = () => (
    <div className='ninja-bg min-h-screen p-4 sm:p-8'>
      <div className='max-w-7xl mx-auto glass rounded-3xl p-6 sm:p-8'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6'>
          <div>
            <h2 className='text-3xl sm:text-4xl font-black text-white'>Dashboard Administrativo</h2>
            <p className='text-slate-300'>
              Usuario: {adminUser?.username} | Rol: {adminUser?.role?.toUpperCase()} | Sede: {adminUser?.sede || 'Nacional'}
            </p>
          </div>
          <div className='flex gap-2'>
            <button onClick={() => setAdminTab('dashboard')} className={`px-4 py-2 rounded-xl ${adminTab === 'dashboard' ? 'bg-cyan-400 text-slate-900' : 'bg-white/10 text-white'}`}>Dashboard</button>
            <button onClick={() => setAdminTab('registros')} className={`px-4 py-2 rounded-xl ${adminTab === 'registros' ? 'bg-cyan-400 text-slate-900' : 'bg-white/10 text-white'}`}>Registros</button>
            <button onClick={adminLogout} className='px-4 py-2 rounded-xl bg-red-500 text-white'>Salir</button>
          </div>
        </div>

        {adminTab === 'dashboard' && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <div className='glass p-5 rounded-2xl'>
              <h3 className='text-xl font-bold text-white mb-3'>POS Autocompletado</h3>
              <div className='flex gap-2'>
                <input className='k-input' placeholder='Cédula para caja' value={posCedula} onChange={(e) => setPosCedula(e.target.value.replace(/\D/g, ''))} />
                <button onClick={posLookup} className='k-btn-primary whitespace-nowrap'>Buscar</button>
              </div>
              {posResult && (
                <div className='mt-4 text-slate-100 space-y-1'>
                  <p><strong>Cliente:</strong> {posResult.nombre} {posResult.apellido}</p>
                  <p><strong>Email:</strong> {posResult.email || '-'}</p>
                  <p><strong>Celular:</strong> {posResult.celular || '-'}</p>
                  <p><strong>Sede:</strong> {posResult.sede || '-'}</p>
                </div>
              )}
            </div>

            <div className='glass p-5 rounded-2xl'>
              <h3 className='text-xl font-bold text-white mb-3'>Facturación en Tiempo Real</h3>
              <div className='flex gap-2'>
                <input className='k-input' placeholder='Cédula para facturar' value={billingCedula} onChange={(e) => setBillingCedula(e.target.value.replace(/\D/g, ''))} />
                <button onClick={billingLookup} className='k-btn-primary whitespace-nowrap'>Lookup</button>
              </div>
              {billingResult && (
                <div className='mt-4 text-slate-100 space-y-2'>
                  <p><strong>Cliente:</strong> {billingResult.nombre} {billingResult.apellido}</p>
                  <p><strong>Monto sugerido:</strong> ${billingResult.amount_suggested} {billingResult.currency}</p>
                  <div className='flex gap-2'>
                    <button onClick={() => sendBillingWebhook('approved')} className='px-3 py-2 rounded-lg bg-emerald-500 text-white'>Aprobado</button>
                    <button onClick={() => sendBillingWebhook('pending')} className='px-3 py-2 rounded-lg bg-orange-500 text-white'>Pendiente</button>
                    <button onClick={() => sendBillingWebhook('rejected')} className='px-3 py-2 rounded-lg bg-rose-500 text-white'>Rechazado</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {adminTab === 'registros' && (
          <div className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-5 gap-3'>
              <input className='k-input md:col-span-2' placeholder='Buscar cédula o nombre' value={recordsQuery} onChange={(e) => setRecordsQuery(e.target.value)} />
              {adminUser?.role === 'master' && (
                <select className='k-input' value={recordsSede} onChange={(e) => setRecordsSede(e.target.value)}>
                  <option value=''>Todas las sedes</option>
                  {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
                </select>
              )}
              <select className='k-input' value={recordsLimit} onChange={(e) => setRecordsLimit(Number.parseInt(e.target.value, 10))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button onClick={() => fetchRecords(1)} className='k-btn-primary'>Buscar</button>
            </div>

            <div className='flex gap-2 flex-wrap'>
              <button onClick={() => exportRecords('csv', 'all')} className='k-btn-soft'>CSV Todo</button>
              <button onClick={() => exportRecords('xlsx', 'all')} className='k-btn-soft'>XLSX Todo</button>
              <button onClick={() => exportRecords('csv', 'page')} className='k-btn-soft'>CSV Página</button>
              <button onClick={() => exportRecords('xlsx', 'page')} className='k-btn-soft'>XLSX Página</button>
            </div>

            <div className='overflow-auto border border-white/20 rounded-2xl'>
              <table className='w-full min-w-[1000px] text-sm text-slate-100'>
                <thead className='bg-white/10'>
                  <tr>
                    <th className='text-left py-3 px-3'>Sede</th>
                    <th className='text-left py-3 px-3'>Cédula</th>
                    <th className='text-left py-3 px-3'>Nombre</th>
                    <th className='text-left py-3 px-3'>Apellido</th>
                    <th className='text-left py-3 px-3'>Email</th>
                    <th className='text-left py-3 px-3'>Celular</th>
                    <th className='text-left py-3 px-3'>Actualizar</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 && (
                    <tr><td colSpan={7} className='text-center py-6 text-slate-300'>Sin registros</td></tr>
                  )}
                  {records.map((row) => (
                    <tr key={row.id} className='border-t border-white/10'>
                      <td className='py-3 px-3'>{row.sede || '-'}</td>
                      <td className='py-3 px-3'>{row.cedula || '-'}</td>
                      <td className='py-3 px-3'>{row.nombre || '-'}</td>
                      <td className='py-3 px-3'>{row.apellido || '-'}</td>
                      <td className='py-3 px-3'>{row.email || '-'}</td>
                      <td className='py-3 px-3'>{row.celular || '-'}</td>
                      <td className='py-3 px-3'><button onClick={() => setEditRecord({ ...row })} className='k-btn-soft'>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='flex items-center justify-between text-slate-100'>
              <p>Total: {recordsTotal}</p>
              <div className='flex items-center gap-2'>
                <button onClick={() => fetchRecords(Math.max(1, recordsPage - 1))} className='k-btn-soft' disabled={recordsPage <= 1}>Anterior</button>
                <span>Página {recordsPage} de {recordsPages}</span>
                <button onClick={() => fetchRecords(Math.min(recordsPages, recordsPage + 1))} className='k-btn-soft' disabled={recordsPage >= recordsPages}>Siguiente</button>
              </div>
            </div>
          </div>
        )}

        <div className='mt-5 text-sm text-slate-200'>
          {message.text && <p className={message.type === 'error' ? 'text-red-300' : 'text-cyan-300'}>{message.text}</p>}
        </div>
      </div>

      {editRecord && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50'>
          <div className='glass rounded-2xl p-5 w-full max-w-2xl'>
            <h3 className='text-white text-2xl font-bold mb-4'>Editar Registro #{editRecord.id}</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <input className='k-input' value={editRecord.nombre || ''} onChange={(e) => setEditRecord((p) => ({ ...p, nombre: e.target.value }))} />
              <input className='k-input' value={editRecord.apellido || ''} onChange={(e) => setEditRecord((p) => ({ ...p, apellido: e.target.value }))} />
              <input className='k-input' value={editRecord.email || ''} onChange={(e) => setEditRecord((p) => ({ ...p, email: e.target.value }))} />
              <input className='k-input' value={editRecord.celular || ''} onChange={(e) => setEditRecord((p) => ({ ...p, celular: e.target.value }))} />
              <input type='date' className='k-input' value={editRecord.fecha_nacimiento || ''} onChange={(e) => setEditRecord((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
              <select className='k-input' value={editRecord.sede || ''} onChange={(e) => setEditRecord((p) => ({ ...p, sede: e.target.value }))} disabled={adminUser?.role !== 'master'}>
                <option value=''>Selecciona sede</option>
                {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
              </select>
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => setEditRecord(null)} className='k-btn-soft'>Cancelar</button>
              <button onClick={saveEditRecord} className='k-btn-primary'>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {billingEvents.length > 0 && adminTab === 'dashboard' && (
        <div className='max-w-7xl mx-auto mt-5 glass rounded-2xl p-4'>
          <h4 className='text-white font-bold mb-3'>Últimos eventos de facturación</h4>
          <div className='overflow-auto'>
            <table className='w-full min-w-[700px] text-sm text-slate-100'>
              <thead className='bg-white/10'>
                <tr>
                  <th className='text-left py-2 px-2'>Fecha</th>
                  <th className='text-left py-2 px-2'>Cédula</th>
                  <th className='text-left py-2 px-2'>Evento</th>
                  <th className='text-left py-2 px-2'>Estado</th>
                  <th className='text-left py-2 px-2'>Monto</th>
                </tr>
              </thead>
              <tbody>
                {billingEvents.map((ev) => (
                  <tr key={ev.id} className='border-t border-white/10'>
                    <td className='py-2 px-2'>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '-'}</td>
                    <td className='py-2 px-2'>{ev.cedula}</td>
                    <td className='py-2 px-2'>{ev.event_type}</td>
                    <td className='py-2 px-2'>{ev.status}</td>
                    <td className='py-2 px-2'>{ev.amount ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  if (view === 'kiosk') return renderKiosk()
  if (view === 'admin-login') return renderAdminLogin()
  if (view === 'admin') {
    if (!adminUser) return renderAdminLogin()
    return renderAdmin()
  }
  return renderWelcome()
}

export default App
