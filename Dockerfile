
# Use a lightweight base image
FROM alpine:latest

# (Optional) Install any dependencies your executable might need.
# For PocketBase, you might need libc6-compat or similar depending on your build.
RUN apk add --no-cache libc6-compat

# Create and set the working directory
WORKDIR /app

# Copy your executable into the container
# Make sure to adjust the filename if needed.
COPY pocketbase /app/pocketbase

# Give execution permissions (if not already set)
RUN chmod +x /app/pocketbase

# Expose the port that PocketBase will run on (default is 8090)
# EXPOSE 8090

# Define the command to run your executable
ENTRYPOINT ["/app/pocketbase"]
