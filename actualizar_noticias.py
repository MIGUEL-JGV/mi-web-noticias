#!/usr/bin/env python3
"""
Script para actualizar noticias desde GNews API
Se ejecuta automáticamente via GitHub Actions
"""

import os
import re
import json
import requests


GNEWS_API_URL = "https://gnews.io/api/v4/top-headlines"
CATEGORY = "general"
LANG = "es"
OUTPUT_FILE = "noticias.json"


def clean_html(text):
    """Elimina etiquetas HTML del texto usando regex"""
    if not text:
        return None
    clean = re.sub(r'<[^>]+>', '', text)
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip() if clean.strip() else None


def clean_value(value):
    """Convierte 'na', 'N/A' y similares a None"""
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in ['na', 'n/a', 'n/a.', 'null', '']:
            return None
    return value


def fetch_news():
    """Obtiene noticias desde GNews API"""
    api_key = os.environ.get('GNEWS_API_KEY')
    
    if not api_key:
        print("ERROR: GNEWS_API_KEY no está configurada")
        return None
    
    params = {
        'category': CATEGORY,
        'lang': LANG,
        'apikey': api_key
    }
    
    try:
        print(f"Obteniendo noticias de GNews API...")
        response = requests.get(GNEWS_API_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if 'articles' not in data:
            print("ERROR: Respuesta API no contiene 'articles'")
            return None
        
        return data['articles']
    
    except requests.exceptions.RequestException as e:
        print(f"ERROR en solicitud HTTP: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"ERROR al decodificar JSON: {e}")
        return None


def process_articles(articles):
    """Procesa y limpia los artículos obtenidos"""
    processed = []
    
    for article in articles:
        processed_article = {
            'title': clean_value(article.get('title')),
            'description': clean_html(clean_value(article.get('description'))),
            'content': clean_value(article.get('content')),
            'url': clean_value(article.get('url')),
            'image': clean_value(article.get('image')),
            'publishedAt': clean_value(article.get('publishedAt')),
            'source': {
                'name': clean_value(article.get('source', {}).get('name')),
                'url': clean_value(article.get('source', {}).get('url'))
            },
            'author': clean_value(article.get('author'))
        }
        processed.append(processed_article)
    
    return processed


def save_news(articles):
    """Guarda las noticias procesadas en el archivo JSON"""
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
        print(f"Noticias guardadas en {OUTPUT_FILE}")
        return True
    except IOError as e:
        print(f"ERROR al guardar archivo: {e}")
        return False


def main():
    """Función principal"""
    print("=" * 50)
    print("Iniciando actualización de noticias")
    print("=" * 50)
    
    articles = fetch_news()
    
    if articles is None:
        print("No se pudieron obtener noticias")
        return 1
    
    print(f"Se encontraron {len(articles)} artículos")
    
    processed_articles = process_articles(articles)
    
    if save_news(processed_articles):
        print("Actualización completada exitosamente")
        return 0
    
    return 1


if __name__ == "__main__":
    exit(main())
