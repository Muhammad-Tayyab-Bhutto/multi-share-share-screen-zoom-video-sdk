FROM ghcr.io/laude-institute/t-bench/python-3-13:20250620

# Install basic tools
RUN apt-get update && apt-get install -y curl build-essential

# Install Node.js (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install pytest (if not already in base, though it seems likely)
RUN pip install pytest

# Create working directory
WORKDIR /app
