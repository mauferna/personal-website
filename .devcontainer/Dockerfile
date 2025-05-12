# Start from the default Dev Container image
FROM mcr.microsoft.com/devcontainers/universal:2

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Install direnv
RUN curl -sfL https://direnv.net/install.sh | bash

# Enable direnv for bash
RUN echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
