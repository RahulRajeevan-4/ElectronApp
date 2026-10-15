import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('todoAPI', {
  getTodos: () => ipcRenderer.invoke('todos:list'),

  addTodo: (title) => ipcRenderer.invoke('todos:add', title),

  toggleTodo: (id) => ipcRenderer.invoke('todos:toggle', id),

  deleteTodo: (id) => ipcRenderer.invoke('todos:delete', id)
})
