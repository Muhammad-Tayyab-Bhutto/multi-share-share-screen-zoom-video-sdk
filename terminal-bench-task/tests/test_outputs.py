"""
Test script for Zoom Video SDK Screenshare Task.

These tests validate that the generated solution is:
1. Valid: Contains proper JSON files and Markdown (README.md) files
2. Non-empty: All critical files have content
3. Correct: The main.ts contains required logic
"""
import pytest
from pathlib import Path
import json

CRITICAL_FILES = [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "tailwind.config.js",
    "index.html",
    "src/style.css",
    "src/utils.ts",
    "src/main.ts",
    "public/coi-serviceworker.js",
    ".env",
    "README.md"
]

def test_files_exist_and_not_empty():
    """Verify that all critical project files exist and are not empty."""
    for filename in CRITICAL_FILES:
        path = Path(filename)
        assert path.exists(), f"Critical file missing: {filename}"
        assert path.stat().st_size > 0, f"Critical file is empty: {filename}"

def test_json_files_are_valid():
    """Verify that JSON configuration files contain valid JSON."""
    json_files = ["package.json", "tsconfig.json"]
    for filename in json_files:
        with open(filename, "r") as f:
            content = f.read()
            assert len(content) > 0, f"JSON file is empty: {filename}"
            data = json.loads(content)
            assert data is not None, f"JSON file parsed to None: {filename}"

def test_markdown_file_is_valid():
    """Verify that README.md exists and contains Markdown content."""
    readme_path = Path("README.md")
    assert readme_path.exists(), "README.md file is missing"
    content = readme_path.read_text()
    assert len(content) > 0, "README.md is empty"
    assert "#" in content, "README.md does not contain any Markdown headings"

def test_package_json_dependencies():
    """Verify package.json contains the required dependencies."""
    with open("package.json", "r") as f:
        data = json.load(f)
    
    deps = data.get("dependencies", {})
    dev_deps = data.get("devDependencies", {})
    
    assert "@zoom/videosdk" in deps, "Missing dependency: @zoom/videosdk"
    assert "jsrsasign" in deps, "Missing dependency: jsrsasign"
    assert "vite" in dev_deps, "Missing devDependency: vite"
    assert "typescript" in dev_deps, "Missing devDependency: typescript"

def test_main_ts_logic():
    """Verify src/main.ts contains the core required logic."""
    with open("src/main.ts", "r") as f:
        content = f.read()
    
    assert "ZoomVideo.createClient()" in content, "Missing ZoomVideo client creation"
    assert "activeShareUserIds.size < 4" in content, "Missing screen share limit logic"
    assert "SharePrivilege.MultipleShare" in content, "Missing MultipleShare setting"
    assert "generateSignature" in content, "Missing generateSignature usage"

def test_index_html_structure():
    """Verify index.html contains required elements."""
    with open("index.html", "r") as f:
        content = f.read()
    
    assert "coi-serviceworker.js" in content, "Missing coi-serviceworker.js script"
    assert "my-screen-share-content-video" in content, "Missing screen share video element"
    assert "share-container" in content, "Missing share-container element"
