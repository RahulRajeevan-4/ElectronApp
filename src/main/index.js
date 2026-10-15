import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

function getTodosFile() {
  return join(app.getPath('userData'), 'todos.json')
}

function readTodos() {
  const file = getTodosFile()

  if (!existsSync(file)) return []

  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))

    if (!Array.isArray(data)) {
      throw new Error('Invalid todos.json data')
    }

    return data.filter((todo) => todo && typeof todo.id === 'string')
  } catch (err) {
    // Keep the corrupt file for recovery and start with an empty list.
    console.error('Failed to read todos.json:', err)
    renameSync(file, `${file}.corrupt-${Date.now()}`)
    return []
  }
}

function assertId(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Invalid task id')
  }
}

function saveTodos(todos) {
  const file = getTodosFile()
  mkdirSync(dirname(file), { recursive: true })

  // Write to a temporary file before replacing the old file.
  const tempFile = `${file}.tmp`
  writeFileSync(tempFile, JSON.stringify(todos, null, 2))
  renameSync(tempFile, file)
}

// Register Todo operations
function registerTodoHandlers() {
  ipcMain.handle('todos:list', () => {
    return readTodos()
  })

  ipcMain.handle('todos:add', (_event, title) => {
    if (typeof title !== 'string' || !title.trim()) {
      throw new Error('Task title is required')
    }

    const cleanTitle = title.trim()

    if (cleanTitle.length > 200) {
      throw new Error('Task title is too long')
    }

    const todos = readTodos()

    const newTodo = {
      id: randomUUID(),
      title: cleanTitle,
      completed: false,
      createdAt: new Date().toISOString()
    }

    todos.push(newTodo)
    saveTodos(todos)

    return newTodo
  })

  ipcMain.handle('todos:toggle', (_event, id) => {
    assertId(id)
    const todos = readTodos()
    const todo = todos.find((item) => item.id === id)

    if (!todo) {
      throw new Error('Todo not found')
    }

    todo.completed = !todo.completed
    saveTodos(todos)

    return todo
  })

  ipcMain.handle('todos:delete', (_event, id) => {
    assertId(id)
    const todos = readTodos()
    const filteredTodos = todos.filter((todo) => todo.id !== id)

    saveTodos(filteredTodos)
    return id
  })
}

// Create desktop window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 600,
    minHeight: 450,
    title: 'Focus Todo',
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Open external links in the default browser instead of new app windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerTodoHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
