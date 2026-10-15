import { useEffect, useState } from 'react'

// Strip Electron's "Error invoking remote method '...': Error:" prefix from IPC errors.
function errorMessage(err) {
  return String(err?.message ?? err).replace(
    /^Error invoking remote method '[^']+': (\w*Error: )?/,
    ''
  )
}

function App() {
  const [todos, setTodos] = useState([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Load saved tasks when the application opens
  useEffect(() => {
    let active = true

    async function loadTodos() {
      try {
        const savedTodos = await window.todoAPI.getTodos()

        if (active) {
          setTodos(savedTodos)
        }
      } catch (err) {
        if (active) {
          setError(errorMessage(err))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadTodos()

    return () => {
      active = false
    }
  }, [])

  async function addTodo(event) {
    event.preventDefault()

    if (!title.trim() || busy) return

    setBusy(true)
    setError('')

    try {
      const newTodo = await window.todoAPI.addTodo(title)

      setTodos((previous) => [...previous, newTodo])
      setTitle('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggleTodo(id) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const updatedTodo = await window.todoAPI.toggleTodo(id)

      setTodos((previous) => previous.map((todo) => (todo.id === id ? updatedTodo : todo)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function deleteTodo(id) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      await window.todoAPI.deleteTodo(id)

      setTodos((previous) => previous.filter((todo) => todo.id !== id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remaining = todos.filter((todo) => !todo.completed).length

  const completed = todos.length - remaining

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div>
            <p className="eyebrow">MY WORKSPACE</p>
            <h1>Focus Todo</h1>
            <p className="subtitle">Stay organized. One task at a time.</p>
          </div>

          <div className="task-count">
            <strong>{remaining}</strong>
            <span>Remaining</span>
          </div>
        </header>

        <form className="add-form" onSubmit={addTodo}>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be done?"
            maxLength={200}
            disabled={loading}
            aria-label="New task"
          />

          <button type="submit" disabled={busy || loading || !title.trim()}>
            + Add Task
          </button>
        </form>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <div className="toolbar">
          <div className="filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All
            </button>

            <button
              className={filter === 'active' ? 'active' : ''}
              onClick={() => setFilter('active')}
            >
              Active
            </button>

            <button
              className={filter === 'completed' ? 'active' : ''}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
          </div>

          <span className="total">{completed} completed</span>
        </div>

        <div className="todo-list">
          {loading ? (
            <p className="empty-state">Loading your tasks...</p>
          ) : filteredTodos.length === 0 ? (
            <p className="empty-state">No tasks to show. Add your first task!</p>
          ) : (
            filteredTodos.map((todo) => (
              <div className="todo-item" key={todo.id}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  disabled={busy}
                  onChange={() => toggleTodo(todo.id)}
                  aria-label={`Complete ${todo.title}`}
                />

                <span className={todo.completed ? 'todo-title done' : 'todo-title'}>
                  {todo.title}
                </span>

                <button
                  className="delete-btn"
                  onClick={() => deleteTodo(todo.id)}
                  disabled={busy}
                  aria-label={`Delete ${todo.title}`}
                  title="Delete task"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="footer">
          <span>{todos.length} total tasks</span>
          <span>Stored locally on your Mac</span>
        </footer>
      </div>
    </div>
  )
}

export default App
