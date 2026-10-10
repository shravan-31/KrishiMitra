import io
from PIL import Image, ImageDraw
from app.ml.disease import load_disease_model, predict_disease

def main():
    load_disease_model()
    img = Image.new('RGB', (224, 224), color=(34, 139, 34))
    draw = ImageDraw.Draw(img)
    for i in range(20, 200, 10):
        draw.line([(20, i), (200, i + 5)], fill=(45, 160, 40), width=2)
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    valid_bytes = buf.getvalue()
    res = predict_disease(valid_bytes)
    print('Top predictions:')
    for pred in res.get('top_predictions', []):
        print(pred['class_name'], pred['confidence'])
    print('Overall confidence:', res.get('confidence'))

if __name__ == '__main__':
    main()
