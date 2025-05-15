from waitress import serve
from main import app

if __name__ == '__main__':
    print("Iniciando servidor con Waitress en http://localhost:5000")
    serve(app, host='0.0.0.0', port=5000)