#!/usr/bin/env bash

# Usage: ./download-artifact.sh <branch> <repository> <artifact-name> [output-folder]
# Example: ./download-artifact.sh main octocat/Hello-World build-artifact my-folder

set -e

BRANCH="$1"
REPO="$2"
ARTIFACT="$3"
OUTPUT_DIR="$4"

if [[ -z "$BRANCH" || -z "$REPO" || -z "$ARTIFACT" ]]; then
  echo "Usage: $0 <branch> <repository> <artifact-name> [output-folder]"
  exit 1
fi

# Get the latest workflow run ID on the specified branch
RUN_ID=$(gh run list --repo "$REPO" --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')

if [[ -z "$RUN_ID" ]]; then
  echo "No workflow runs found for branch '$BRANCH' in repository '$REPO'"
  exit 1
fi

# Prepare download command with or without output directory
if [[ -n "$OUTPUT_DIR" ]]; then
  mkdir -p "$OUTPUT_DIR"
  gh run download "$RUN_ID" --repo "$REPO" --name "$ARTIFACT" --dir "$OUTPUT_DIR"
else
  gh run download "$RUN_ID" --repo "$REPO" --name "$ARTIFACT"
fi

echo "Artifact '$ARTIFACT' from branch '$BRANCH' in repo '$REPO' has been downloaded
