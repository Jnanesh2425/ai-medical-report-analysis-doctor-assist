import io from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

let socket = null

export const socketService = {
  connect: (token) => {
    if (!socket) {
      socket = io(SOCKET_URL, {
        auth: {
          token
        }
      })
    }
    return socket
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },

  getSocket: () => socket,

  on: (event, callback) => {
    if (socket) {
      socket.on(event, callback)
    }
  },

  off: (event, callback) => {
    if (socket) {
      socket.off(event, callback)
    }
  },

  emit: (event, data) => {
    if (socket) {
      socket.emit(event, data)
    }
  }
}