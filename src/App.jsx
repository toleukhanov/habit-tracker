import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
const DOWS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const FREQ_LABELS = {
  daily:'каждый день', weekdays:'будни', weekends:'выходные',
  every_other:'через день', weekly:'раз в неделю', monthly:'раз в месяц', custom:''
}

function toStr(d) { return (d||new Date()).toISOString().slice(0,10) }
function fromStr(s) { return new Date(s+'T12:00:00') }

function isDue(habit, dateStr) {
  const d=fromStr(dateStr), dow=d.getDay()
  if (habit.freq==='daily') return true
  if (habit.freq==='weekdays') return dow>=1&&dow<=5
  if (habit.freq==='weekends') return dow===0||dow===6
  if (habit.freq==='custom') return Array.isArray(habit.days)&&habit.days.includes(dow)
  if (habit.freq==='every_other') {
    const ref=fromStr(habit.created_at||'2025-01-01')
    return Math.round((d-ref)/86400000)%2===0
  }
  if (habit.freq==='weekly') {
    const ref=fromStr(habit.created_at||'2025-01-01')
    return Math.round((d-ref)/86400000)%7===0
  }
  if (habit.freq==='monthly') return d.getDate()===1
  // one-time (postponed)
  if (habit.freq==='once') return dateStr===habit.once_date
  return true
}

function freqLabel(habit) {
  if (habit.freq==='custom'&&habit.days?.length)
    return habit.days.slice().sort((a,b)=>a-b).map(d=>DOWS[d]).join(', ')
  if (habit.freq==='once') return 'перенесено'
  return FREQ_LABELS[habit.freq]||habit.freq
}

function getStreak(habit, completions) {
  let s=0; const d=new Date(); const today=toStr()
  for (let i=0;i<90;i++) {
    const ds=toStr(d)
    if (isDue(habit,ds)) {
      if (completions[`${habit.id}:${ds}`]) s++
      else if (ds!==today) break
    }
    d.setDate(d.getDate()-1)
  }
  return s
}

// Swipe component
function SwipeItem({ children, onSkip, onTomorrow }) {
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const startX = useRef(null)
  const ACTION_WIDTH = 140

  function onTouchStart(e) { startX.current = e.touches[0].clientX }
  function onTouchMove(e) {
    if (startX.current === null) return
    const diff = startX.current - e.touches[0].clientX
    if (diff > 0) setOffset(Math.min(diff, ACTION_WIDTH))
    else if (open) setOffset(Math.max(ACTION_WIDTH + diff, 0))
  }
  function onTouchEnd() {
    startX.current = null
    if (offset > ACTION_WIDTH / 2) { setOffset(ACTION_WIDTH); setOpen(true) }
    else { setOffset(0); setOpen(false) }
  }
  function close() { setOffset(0); setOpen(false) }

  return (
    <div className="swipe-wrap">
      <div className="swipe-actions">
        <button className="swipe-btn swipe-skip" onClick={()=>{close();onSkip()}}>
          <span>🚫</span>Пропустить
        </button>
        <button className="swipe-btn swipe-tomorrow" onClick={()=>{close();onTomorrow()}}>
          <span>📅</span>Завтра
        </button>
      </div>
      <div className="swipe-item"
        style={{transform:`translateX(-${offset}px)`}}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={()=>open&&close()}
      >
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{textAlign:'center',padding:'40px',color:'#888'}}>Загрузка...</div>
  if (!user) return <AuthScreen />
  return <MainApp user={user} />
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!email||!password) { setError('Заполни все поля'); return }
    setLoading(true); setError('')
    if (mode==='login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Неверный email или пароль')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError('Ошибка: '+error.message)
      else setSuccess('Проверь почту и подтверди email')
    }
    setLoading(false)
  }

  return (
    <div style={{padding:'40px 20px',maxWidth:'360px',margin:'0 auto'}}>
      <div style={{textAlign:'center',marginBottom:'32px'}}>
        <div style={{fontSize:'40px',marginBottom:'8px'}}>✅</div>
        <div style={{fontSize:'24px',fontWeight:'700'}}>Привычки</div>
        <div style={{fontSize:'14px',color:'#888',marginTop:'4px'}}>Ежедневный трекер</div>
      </div>
      <div style={{background:'#fff',borderRadius:'16px',padding:'20px'}}>
        <div style={{display:'flex',marginBottom:'20px',background:'#f5f5f5',borderRadius:'10px',padding:'3px'}}>
          {[['login','Войти'],['register','Регистрация']].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setError('');setSuccess('')}}
              style={{flex:1,padding:'8px',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:500,fontSize:'14px',
                background:mode===m?'#fff':'transparent',color:mode===m?'#1a1a1a':'#888',
                boxShadow:mode===m?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>
              {l}
            </button>
          ))}
        </div>
        {success ? (
          <div style={{textAlign:'center',padding:'20px',color:'#1D9E75',fontSize:'14px'}}>{success}</div>
        ) : (
          <>
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'13px',color:'#888',display:'block',marginBottom:'4px'}}>Email</label>
              <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'13px',color:'#888',display:'block',marginBottom:'4px'}}>Пароль</label>
              <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="минимум 6 символов" onKeyDown={e=>e.key==='Enter'&&submit()} />
            </div>
            {error&&<div style={{color:'#e24b4a',fontSize:'13px',marginBottom:'12px'}}>{error}</div>}
            <button className="add-btn" onClick={submit} disabled={loading}>
              {loading?'Подождите...':mode==='login'?'Войти':'Зарегистрироваться'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MainApp({ user }) {
  const [tab, setTab] = useState('today')
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState({})
  const [skips, setSkips] = useState({}) // { 'habitId:date': true }
  const [viewDate, setViewDate] = useState(toStr())
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const today = toStr()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: h }, { data: c }, { data: sk }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('completions').select('habit_id, completed_at'),
      supabase.from('skips').select('habit_id, skipped_date')
    ])
    setHabits(h||[])
    const cmap = {}
    ;(c||[]).forEach(x => { cmap[`${x.habit_id}:${x.completed_at}`]=true })
    setCompletions(cmap)
    const smap = {}
    ;(sk||[]).forEach(x => { smap[`${x.habit_id}:${x.skipped_date}`]=true })
    setSkips(smap)
    setLoading(false)
  }

  async function toggleHabit(habit) {
    const key=`${habit.id}:${viewDate}`
    const was=!!completions[key]
    setCompletions(prev => { const next={...prev}; if(was) delete next[key]; else next[key]=true; return next })
    if (was) await supabase.from('completions').delete().eq('habit_id',habit.id).eq('completed_at',viewDate)
    else await supabase.from('completions').insert({ habit_id:habit.id, completed_at:viewDate, user_id:user.id })
  }

  async function skipHabit(habit) {
    const key=`${habit.id}:${viewDate}`
    setSkips(prev => ({...prev, [key]:true}))
    await supabase.from('skips').upsert({ habit_id:habit.id, skipped_date:viewDate, user_id:user.id }, { onConflict:'habit_id,skipped_date' })
  }

  async function postponeToTomorrow(habit) {
    const tomorrow = toStr(new Date(fromStr(viewDate).setDate(fromStr(viewDate).getDate()+1)))
    // Create a one-time copy for tomorrow
    await supabase.from('habits').insert({
      name: habit.name,
      freq: 'once',
      days: [],
      time: habit.time,
      once_date: tomorrow,
      user_id: user.id,
      created_at: today
    })
    // Skip today
    await skipHabit(habit)
    // Reload
    const { data: h } = await supabase.from('habits').select('*').order('created_at')
    setHabits(h||[])
  }

  async function addHabit(data) {
    const { data: h } = await supabase.from('habits').insert({...data, user_id:user.id}).select().single()
    if (h) setHabits(prev=>[...prev,h])
  }

  async function deleteHabit(id) {
    setHabits(prev=>prev.filter(h=>h.id!==id))
    await supabase.from('habits').delete().eq('id',id)
  }

  if (loading) return <div style={{textAlign:'center',padding:'40px',color:'#888'}}>Загрузка...</div>

  return (
    <div>
      <nav className="nav">
        {[['today','Сегодня'],['analytics','Аналитика'],['manage','Задачи']].map(([t,l])=>(
          <button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </nav>
      {tab==='today' && <TodayTab habits={habits} completions={completions} skips={skips} viewDate={viewDate} setViewDate={setViewDate} today={today} toggleHabit={toggleHabit} skipHabit={skipHabit} postponeToTomorrow={postponeToTomorrow} openModal={()=>setModal(true)} user={user} logout={()=>supabase.auth.signOut()} />}
      {tab==='analytics' && <AnalyticsTab habits={habits} completions={completions} />}
      {tab==='manage' && <ManageTab habits={habits} deleteHabit={deleteHabit} openModal={()=>setModal(true)} />}
      {modal && <AddModal onSave={addHabit} onClose={()=>setModal(false)} today={today} />}
    </div>
  )
}

function TodayTab({ habits, completions, skips, viewDate, setViewDate, today, toggleHabit, skipHabit, postponeToTomorrow, openModal, user, logout }) {
  const d = fromStr(viewDate)
  const due = habits.filter(h=>isDue(h,viewDate))
  const skipped = due.filter(h=>skips[`${h.id}:${viewDate}`])
  const active = due.filter(h=>!skips[`${h.id}:${viewDate}`])
  const done = active.filter(h=>completions[`${h.id}:${viewDate}`])
  const pct = active.length ? Math.round(done.length/active.length*100) : 0
  const allDone = active.length>0&&done.length===active.length

  function prevDay() { const d=fromStr(viewDate); d.setDate(d.getDate()-1); setViewDate(toStr(d)) }
  function nextDay() { if(viewDate>=today)return; const d=fromStr(viewDate); d.setDate(d.getDate()+1); setViewDate(toStr(d)) }

  const undone = active.filter(h=>!completions[`${h.id}:${viewDate}`])
  const doneItems = active.filter(h=>completions[`${h.id}:${viewDate}`])

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',color:'#888'}}>{user.email}</div>
        <button onClick={logout} style={{border:'none',background:'none',cursor:'pointer',fontSize:'13px',color:'#888'}}>Выйти</button>
      </div>
      <div className="date-nav">
        <button onClick={prevDay}>‹</button>
        <span>{d.getDate()} {MONTHS[d.getMonth()]} · {DOWS[d.getDay()]}</span>
        <button onClick={nextDay} style={{opacity:viewDate>=today?0.3:1}}>›</button>
      </div>
      {active.length>0 && (
        <div className="progress-wrap">
          <div className="progress-label"><span>{done.length} из {active.length} выполнено</span><span>{pct}%</span></div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`}} /></div>
        </div>
      )}
      {allDone && <div className="win-banner">🎉 Все задачи выполнены!</div>}
      {!due.length && <div className="empty">Нет задач на этот день</div>}

      {[...undone, ...doneItems].map(h => {
        const isDone=!!completions[`${h.id}:${viewDate}`]
        const streak=getStreak(h,completions)
        return (
          <SwipeItem key={h.id} onSkip={()=>skipHabit(h)} onTomorrow={()=>postponeToTomorrow(h)}>
            <div className={`habit-item ${isDone?'done':''}`}>
              <button className={`check-btn ${isDone?'done':''}`} onClick={()=>toggleHabit(h)}>{isDone?'✓':''}</button>
              <div className="habit-info">
                <div className="habit-name">{h.name}</div>
                <div className="habit-meta">
                  {h.time&&`${h.time} · `}{freqLabel(h)}
                  {streak>1&&<span className="streak"> · 🔥 {streak}</span>}
                </div>
              </div>
            </div>
          </SwipeItem>
        )
      })}

      {skipped.length>0 && (
        <>
          <div style={{fontSize:'12px',color:'#aaa',margin:'12px 0 8px',paddingLeft:'4px'}}>Пропущено</div>
          {skipped.map(h=>(
            <div key={h.id} className="habit-item skipped">
              <div style={{width:28,height:28,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>🚫</div>
              <div className="habit-info">
                <div className="habit-name">{h.name} <span className="skip-badge">пропущено</span></div>
                <div className="habit-meta">{freqLabel(h)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      <button className="add-btn" style={{marginTop:'16px'}} onClick={openModal}>+ Добавить задачу</button>
    </div>
  )
}

function AnalyticsTab({ habits, completions }) {
  const today=new Date()
  const last30=Array.from({length:30},(_,i)=>{ const d=new Date(today); d.setDate(d.getDate()-(29-i)); return toStr(d) })
  let tDue=0,tDone=0
  last30.forEach(ds=>habits.filter(h=>h.freq!=='once').forEach(h=>{ if(isDue(h,ds)){ tDue++; if(completions[`${h.id}:${ds}`]) tDone++ } }))
  const pct=tDue?Math.round(tDone/tDue*100):0
  let bestStreak=0
  habits.forEach(h=>{ const s=getStreak(h,completions); if(s>bestStreak) bestStreak=s })
  let bestDow='—',bestDowPct=0
  ;[0,1,2,3,4,5,6].forEach(dow=>{
    let c=0,t=0
    last30.forEach(ds=>{ if(fromStr(ds).getDay()===dow) habits.filter(h=>h.freq!=='once').forEach(h=>{ if(isDue(h,ds)){ t++; if(completions[`${h.id}:${ds}`]) c++ } }) })
    if(t>0&&c/t>bestDowPct){ bestDowPct=c/t; bestDow=DOWS[dow] }
  })
  return (
    <div className="page">
      <div className="page-title">Аналитика</div>
      <div className="page-sub">последние 30 дней</div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value">{pct}%</div><div className="stat-label">выполнение</div></div>
        <div className="stat-card"><div className="stat-value">{bestStreak}</div><div className="stat-label">макс. серия</div></div>
        <div className="stat-card"><div className="stat-value">{habits.filter(h=>h.freq!=='once').length}</div><div className="stat-label">задач</div></div>
        <div className="stat-card"><div className="stat-value">{bestDow}</div><div className="stat-label">лучший день{bestDow!=='—'?` · ${Math.round(bestDowPct*100)}%`:''}</div></div>
      </div>
      {habits.filter(h=>h.freq!=='once').map(h=>{
        let due=0,done=0
        last30.forEach(ds=>{ if(isDue(h,ds)){ due++; if(completions[`${h.id}:${ds}`]) done++ } })
        const p=due?Math.round(done/due*100):0
        return (
          <div key={h.id} className="bar-row">
            <div className="bar-header"><span>{h.name}</span><span>{p}%</span></div>
            <div className="bar-track"><div className="bar-fill" style={{width:`${p}%`}} /></div>
          </div>
        )
      })}
    </div>
  )
}

function ManageTab({ habits, deleteHabit, openModal }) {
  return (
    <div className="page">
      <div className="page-title">Задачи</div>
      {habits.filter(h=>h.freq!=='once').map(h=>(
        <div key={h.id} className="manage-item">
          <div className="manage-info">
            <div className="manage-name">{h.name}</div>
            <div className="manage-freq">{freqLabel(h)}{h.time?` · ${h.time}`:''}</div>
          </div>
          <button className="delete-btn" onClick={()=>deleteHabit(h.id)}>×</button>
        </div>
      ))}
      <button className="add-btn" onClick={openModal}>+ Добавить задачу</button>
    </div>
  )
}

const FREQS=[['daily','Каждый день'],['weekdays','Будни пн–пт'],['weekends','Выходные'],['every_other','Через день'],['weekly','Раз в неделю'],['monthly','Раз в месяц'],['custom','Выбрать дни']]

function AddModal({ onSave, onClose, today }) {
  const [name,setName]=useState('')
  const [freq,setFreq]=useState('daily')
  const [days,setDays]=useState([])
  const [time,setTime]=useState('')
  function toggleDay(dow) { setDays(prev=>prev.includes(dow)?prev.filter(d=>d!==dow):[...prev,dow]) }
  function save() {
    if (!name.trim()) return
    if (freq==='custom'&&!days.length) return
    onSave({ name:name.trim(), freq, days, time, created_at:today })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target.classList.contains('modal-overlay')&&onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">Новая задача</div>
        <div className="form-group">
          <label className="form-label">Название</label>
          <input className="form-input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Например: медитация" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Частота</label>
          <div className="freq-grid">
            {FREQS.map(([f,l])=>(
              <button key={f} className={`freq-btn ${f==='custom'?'full':''} ${freq===f?'active':''}`} onClick={()=>setFreq(f)}>{l}</button>
            ))}
          </div>
        </div>
        {freq==='custom'&&(
          <div className="form-group">
            <label className="form-label">Дни недели</label>
            <div className="days-grid">
              {[[1,'Пн'],[2,'Вт'],[3,'Ср'],[4,'Чт'],[5,'Пт'],[6,'Сб'],[0,'Вс']].map(([d,l])=>(
                <button key={d} className={`day-btn ${days.includes(d)?'active':''}`} onClick={()=>toggleDay(d)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Время (необязательно)</label>
          <input className="form-input" type="time" value={time} onChange={e=>setTime(e.target.value)} />
        </div>
        <div className="btn-row">
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button className="btn-save" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
