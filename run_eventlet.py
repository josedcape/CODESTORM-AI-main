import eventlet
eventlet.monkey_patch()
from main import app, socketio

if __name__ == '__main__':
    print("Iniciando servidor con Eventlet en http://localhost:5000")
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=False
    )