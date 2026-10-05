import os, urllib.request, zipfile, pathlib

def download_plantvillage():
    url = "https://data.mendeley.com/public-files/datasets/tywbtsjrjv/files/d5652a28-c1d8-4b76-97f3-72fb80f94efc/file_downloaded"
    # Alternative: kaggle datasets download -d emmarex/plantdisease
    dest = pathlib.Path("backend/data/raw/plantvillage")
    dest.mkdir(parents=True, exist_ok=True)
    print("Download PlantVillage from Kaggle:")
    print("  kaggle datasets download -d emmarex/plantdisease")
    print(f"  unzip to: {dest}/")
    print("Expected structure after unzip:")
    print("  backend/data/raw/plantvillage/PlantVillage/<ClassName>/*.jpg")

if __name__ == "__main__":
    download_plantvillage()
