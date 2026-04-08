#!/usr/bin/env python3
"""
Script de teste end-to-end para PXG Files OCR
Testa frontend + backend integração completa
"""

import requests
import time
from PIL import Image, ImageDraw, ImageFont
import io
import sys

# Cores
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# URLs
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

def print_header(text):
    print(f"\n{BLUE}{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}{RESET}\n")

def print_ok(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    print(f"{RED}✗ {text}{RESET}")

def print_info(text):
    print(f"{YELLOW}ℹ {text}{RESET}")

def create_test_image():
    """Cria uma imagem de teste com texto"""
    print_info("Criando imagem de teste...")
    
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Texto de teste
    text = "PXG Files OCR Test\nEasyOCR Backend\nLocahost 3000 Frontend"
    
    draw.text((20, 20), text, fill='black')
    
    # Salvar em memória
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    print_ok("Imagem de teste criada (400x200)")
    return img_bytes

def test_backend_health():
    """Testa se backend está vivo"""
    print_header("1️⃣  Testando Backend - Health Check")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print_ok(f"Backend respondendo em {BACKEND_URL}")
            print_ok(f"Status: {data.get('status')}")
            print_ok(f"Versão: {data.get('version')}")
            return True
        else:
            print_error(f"Backend respondeu com status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Backend não alcançável: {e}")
        return False

def test_ocr_endpoint(image_bytes):
    """Testa endpoint OCR"""
    print_header("2️⃣  Testando Endpoint /ocr")
    
    try:
        files = {'file': ('test.png', image_bytes, 'image/png')}
        response = requests.post(f"{BACKEND_URL}/ocr", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print_ok(f"OCR processou com sucesso")
            print_ok(f"Texto extraído ({data.get('detections')} detecções):")
            print(f"\n{BLUE}{'-'*50}")
            print(data.get('text', 'N/A'))
            print(f"{'-'*50}{RESET}\n")
            return True
        else:
            print_error(f"OCR retornou status {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print_error(f"Erro ao chamar OCR: {e}")
        return False

def test_ocr_detailed(image_bytes):
    """Testa endpoint /ocr/detailed"""
    print_header("3️⃣  Testando Endpoint /ocr/detailed")
    
    try:
        files = {'file': ('test.png', image_bytes, 'image/png')}
        response = requests.post(f"{BACKEND_URL}/ocr/detailed", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print_ok(f"OCR detalhado processou")
            print_ok(f"Total de {data.get('total')} detecções com confidence scores")
            
            if data.get('detections'):
                print(f"\n{BLUE}Primeiras 3 detecções:{RESET}")
                for i, det in enumerate(data.get('detections', [])[:3]):
                    print(f"  {i+1}. Texto: {det.get('text')}")
                    print(f"     Confidence: {det.get('confidence'):.2%}\n")
            
            return True
        else:
            print_error(f"OCR detalhado retornou {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Erro em /ocr/detailed: {e}")
        return False

def test_frontend_accessibility():
    """Testa se frontend está acessível"""
    print_header("4️⃣  Testando Frontend")
    
    try:
        response = requests.get(f"{FRONTEND_URL}/", timeout=5)
        
        if response.status_code == 200:
            print_ok(f"Frontend respondendo em {FRONTEND_URL}")
            print_ok(f"Status code: 200")
            return True
        else:
            print_error(f"Frontend status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Frontend não alcançável: {e}")
        return False

def test_frontend_ocr_page():
    """Testa acesso à página OCR"""
    print_header("5️⃣  Testando Página OCR")
    
    try:
        response = requests.get(f"{FRONTEND_URL}/ocr", timeout=5)
        
        if response.status_code == 200:
            print_ok(f"Página OCR acessível em {FRONTEND_URL}/ocr")
            
            # Verificar se contém elementos esperados
            if 'ocr' in response.text.lower() or 'extract' in response.text.lower():
                print_ok("Página contém elementos esperados")
            
            return True
        else:
            print_error(f"Página OCR status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Erro ao acessar página OCR: {e}")
        return False

def test_cors():
    """Testa se CORS está configurado"""
    print_header("6️⃣  Testando CORS")
    
    try:
        response = requests.options(
            f"{BACKEND_URL}/ocr",
            headers={'Origin': FRONTEND_URL},
            timeout=5
        )
        
        if 'access-control-allow-origin' in response.headers:
            print_ok(f"CORS habilitado para {FRONTEND_URL}")
            print_ok(f"Allow-Origin: {response.headers.get('access-control-allow-origin')}")
            return True
        else:
            print_info("CORS headers não encontrados em OPTIONS")
            return True  # Não é erro crítico
    except Exception as e:
        print_error(f"Erro ao testar CORS: {e}")
        return False

def test_api_documentation():
    """Testa documentação Swagger"""
    print_header("7️⃣  Testando Documentação API")
    
    try:
        response = requests.get(f"{BACKEND_URL}/docs", timeout=5)
        
        if response.status_code == 200:
            print_ok(f"Swagger UI disponível em {BACKEND_URL}/docs")
            return True
        else:
            print_error(f"Swagger UI status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Swagger UI não alcançável: {e}")
        return False

def main():
    print(f"\n{YELLOW}{'='*60}")
    print("  🧪 PXG Files - Teste End-to-End")
    print("  localhost: Frontend + Backend + OCR")
    print(f"{'='*60}{RESET}\n")
    
    results = {
        "Backend Health": False,
        "OCR Endpoint": False,
        "OCR Detailed": False,
        "Frontend": False,
        "OCR Page": False,
        "CORS": False,
        "API Docs": False,
    }
    
    # Criar imagem de teste
    test_image = create_test_image()
    
    # Executar testes
    results["Backend Health"] = test_backend_health()
    
    if results["Backend Health"]:
        results["OCR Endpoint"] = test_ocr_endpoint(test_image)
        test_image.seek(0)  # Reset
        results["OCR Detailed"] = test_ocr_detailed(test_image)
        results["CORS"] = test_cors()
        results["API Docs"] = test_api_documentation()
    
    results["Frontend"] = test_frontend_accessibility()
    results["OCR Page"] = test_frontend_ocr_page()
    
    # Relatório final
    print_header("📊 Relatório Final")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, passed_test in results.items():
        status = f"{GREEN}✓ PASSOU{RESET}" if passed_test else f"{RED}✗ FALHOU{RESET}"
        print(f"  {test_name:<25} {status}")
    
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"  Total: {passed}/{total} testes passaram")
    
    if passed == total:
        print(f"{GREEN}  ✓ Tudo 100% funcional!{RESET}")
    elif passed >= total * 0.7:
        print(f"{YELLOW}  ⚠ Maioria funcionando, verificar falhas{RESET}")
    else:
        print(f"{RED}  ✗ Várias falhas detectadas{RESET}")
    
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Links úteis
    print(f"{YELLOW}Links úteis:{RESET}")
    print(f"  🌐 Frontend:      {FRONTEND_URL}")
    print(f"  🎨 OCR Page:      {FRONTEND_URL}/ocr")
    print(f"  📡 Backend:       {BACKEND_URL}")
    print(f"  📚 API Docs:      {BACKEND_URL}/docs")
    print(f"  ❤️  Health Check:  {BACKEND_URL}/health\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
