from main_completo import app, socketio

# Cambiar el modo asíncrono a threading en lugar de eventlet
socketio.async_mode = 'threading'

if __name__ == '__main__':
    print("Iniciando servidor con modo threading en http://localhost:5000")
    socketio.run(app, host='127.0.0.1', port=5000, debug=False, use_reloader=False)