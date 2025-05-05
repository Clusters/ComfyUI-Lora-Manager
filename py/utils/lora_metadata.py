from safetensors import safe_open
from typing import Dict
from .model_utils import determine_base_model
import os
import logging

logger = logging.getLogger(__name__)

async def extract_lora_metadata(file_path: str) -> Dict:
    """Extract essential metadata from safetensors file"""
    try:
        with safe_open(file_path, framework="pt", device="cpu") as f:
            metadata = f.metadata()
            if metadata:
                # Only extract base_model from ss_base_model_version
                base_model = determine_base_model(metadata.get("ss_base_model_version"))
                return {"base_model": base_model}
    except Exception as e:
        print(f"Error reading metadata from {file_path}: {str(e)}")
    return {"base_model": "Unknown"}

async def extract_checkpoint_metadata(file_path: str) -> dict:
    """Extract metadata from a checkpoint file to determine model type and base model"""
    try:
        # Analyze filename for clues about the model
        filename = os.path.basename(file_path).lower()
        
        model_info = {
            'base_model': 'Unknown',
            'model_type': 'checkpoint'
        }
        
        # Detect base model from filename
        if 'xl' in filename or 'sdxl' in filename:
            model_info['base_model'] = 'SDXL'
        elif 'sd3' in filename:
            model_info['base_model'] = 'SD3'  
        elif 'sd2' in filename or 'v2' in filename:
            model_info['base_model'] = 'SD2.x'
        elif 'sd1' in filename or 'v1' in filename:
            model_info['base_model'] = 'SD1.5'
        
        # Detect model type from filename
        if 'inpaint' in filename:
            model_info['model_type'] = 'inpainting'
        elif 'anime' in filename:
            model_info['model_type'] = 'anime'
        elif 'realistic' in filename:
            model_info['model_type'] = 'realistic'
        
        # Try to peek at the safetensors file structure if available
        if file_path.endswith('.safetensors'):
            import json
            import struct
            
            with open(file_path, 'rb') as f:
                header_size = struct.unpack('<Q', f.read(8))[0]
                header_json = f.read(header_size)
                header = json.loads(header_json)
                
                # Look for specific keys to identify model type
                metadata = header.get('__metadata__', {})
                if metadata:
                    # Try to determine if it's SDXL
                    if any(key.startswith('conditioner.embedders.1') for key in header):
                        model_info['base_model'] = 'SDXL'
                    
                    # Look for model type info
                    if metadata.get('modelspec.architecture') == 'SD-XL':
                        model_info['base_model'] = 'SDXL'
                    elif metadata.get('modelspec.architecture') == 'SD-3':
                        model_info['base_model'] = 'SD3'
                    
                    # Check for specific use case
                    if metadata.get('modelspec.purpose') == 'inpainting':
                        model_info['model_type'] = 'inpainting'
        
        return model_info
        
    except Exception as e:
        logger.error(f"Error extracting checkpoint metadata for {file_path}: {e}")
        # Return default values
        return {'base_model': 'Unknown', 'model_type': 'checkpoint'}