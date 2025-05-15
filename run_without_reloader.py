from main_completo import app, socketio

if __name__ == '__main__':
    # Desactivar el reloader y el modo debug para evitar el conflicto
    socketio.run(app, host='127.0.0.1', port=5000, debug=False, use_reloader=False)