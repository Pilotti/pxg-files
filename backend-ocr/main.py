from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import io
from PIL import Image
import os

app = FastAPI(title="OCR API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR reader (loads model on startup)
print("Loading EasyOCR model...")
reader = easyocr.Reader(['pt'], gpu=False)  # Set gpu=True if you have CUDA
print("Model loaded!")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "version": "1.0.0"}

@app.post("/ocr")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract text from image using EasyOCR
    
    Args:
        file: Image file (JPG, PNG, etc.)
    
    Returns:
        JSON with extracted text
    """
    try:
        # Read uploaded file
        content = await file.read()
        
        # Open image with PIL
        image = Image.open(io.BytesIO(content))
        
        # Run OCR
        result = reader.readtext(image)
        
        # Extract text from results
        text = "\n".join([detection[1] for detection in result])
        
        return {
            "success": True,
            "text": text,
            "detections": len(result)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "text": ""
        }

@app.post("/ocr/detailed")
async def extract_text_detailed(file: UploadFile = File(...)):
    """
    Extract text with confidence scores
    """
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content))
        result = reader.readtext(image)
        
        # Return detailed results
        detections = [
            {
                "text": detection[1],
                "confidence": float(detection[2]),
                "bbox": detection[0]
            }
            for detection in result
        ]
        
        return {
            "success": True,
            "detections": detections,
            "total": len(detections)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "detections": []
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
