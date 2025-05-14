#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Causes a pipeline to return the exit status of the last command in the pipe that returned a non-zero return value.

# --- Configuration ---
# Adjust these paths if your files are located elsewhere or named differently.
MANIFEST_FILE="manifest.json"
PACKAGE_JSON_FILE="package.json"
EXPECTED_BRANCH="main"

# --- Helper Functions ---
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. jq is required to parse JSON files."
    echo "Please install jq to proceed (e.g., 'sudo apt-get install jq' or 'brew install jq')."
    exit 1
  fi
}

get_version_from_json() {
  local file_path="$1"
  local key_path="${2:-.version}" # Default key path is .version
  if [ ! -f "$file_path" ]; then
    echo "Error: File not found: $file_path"
    exit 1
  fi
  
  local version
  version=$(jq -r "$key_path" "$file_path")
  
  if [ -z "$version" ] || [ "$version" == "null" ]; then
    echo "Error: Could not extract version using key '$key_path' from $file_path, or version is null."
    exit 1
  fi
  echo "$version"
}

# --- Main Script ---
echo "Starting release tagging process..."
echo "---------------------------------"

# 0. Check for dependencies
echo "Checking for jq..."
check_jq
echo "jq found."
echo ""

# 1. Get versions
echo "Fetching version from $MANIFEST_FILE..."
MANIFEST_VERSION=$(get_version_from_json "$MANIFEST_FILE")
echo "Manifest version: $MANIFEST_VERSION"
echo ""

echo "Fetching version from $PACKAGE_JSON_FILE..."
PACKAGE_JSON_VERSION=$(get_version_from_json "$PACKAGE_JSON_FILE")
echo "Package.json version: $PACKAGE_JSON_VERSION"
echo ""

# 2. Compare versions
echo "Comparing versions..."
if [ "$MANIFEST_VERSION" != "$PACKAGE_JSON_VERSION" ]; then
  echo "Error: Version mismatch!"
  echo "Manifest version ($MANIFEST_VERSION) does not match package.json version ($PACKAGE_JSON_VERSION)."
  exit 1
fi
VERSION_TO_TAG="v$MANIFEST_VERSION"
echo "Versions match: $MANIFEST_VERSION. Tag will be $VERSION_TO_TAG."
echo ""

# 3. Check current branch
echo "Checking current Git branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "Error: Not on branch '$EXPECTED_BRANCH'. Current branch is '$CURRENT_BRANCH'."
  echo "Please switch to the '$EXPECTED_BRANCH' branch."
  exit 1
fi
echo "Currently on branch '$EXPECTED_BRANCH'."
echo ""

# 4. Check for clean workspace
echo "Checking Git workspace status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Workspace is not clean. Uncommitted changes or untracked files present."
    echo "Please commit, stash, or .gitignore your changes/files."
    echo "Output of 'git status --porcelain':"
    git status --porcelain
    exit 1
fi
echo "Workspace is clean."
echo ""

# 5. Check if local $EXPECTED_BRANCH matches origin/$EXPECTED_BRANCH and all commits are pushed
echo "Fetching remote updates for branch '$EXPECTED_BRANCH'..."
git fetch origin "$EXPECTED_BRANCH"
echo "Fetch complete."
echo ""

echo "Verifying '$EXPECTED_BRANCH' synchronization with 'origin/$EXPECTED_BRANCH'..."
LOCAL_BRANCH_REF="refs/heads/$EXPECTED_BRANCH"
REMOTE_BRANCH_REF="refs/remotes/origin/$EXPECTED_BRANCH"

# Ensure the remote branch exists locally after fetch
if ! git show-ref --verify --quiet "$REMOTE_BRANCH_REF"; then
    echo "Error: Remote branch 'origin/$EXPECTED_BRANCH' not found locally after fetch."
    echo "Ensure the remote repository and branch exist and are accessible."
    exit 1
fi

# Number of commits on local $EXPECTED_BRANCH that are not on origin/$EXPECTED_BRANCH (local is ahead)
COMMITS_AHEAD=$(git rev-list --count "$REMOTE_BRANCH_REF".."$LOCAL_BRANCH_REF")

# Number of commits on origin/$EXPECTED_BRANCH that are not on local $EXPECTED_BRANCH (local is behind)
COMMITS_BEHIND=$(git rev-list --count "$LOCAL_BRANCH_REF".."$REMOTE_BRANCH_REF")

if [ "$COMMITS_AHEAD" -ne 0 ]; then
    echo "Error: Local branch '$EXPECTED_BRANCH' is $COMMITS_AHEAD commit(s) ahead of 'origin/$EXPECTED_BRANCH'."
    echo "Please push your changes to 'origin/$EXPECTED_BRANCH'."
    exit 1
fi

if [ "$COMMITS_BEHIND" -ne 0 ]; then
    echo "Error: Local branch '$EXPECTED_BRANCH' is $COMMITS_BEHIND commit(s) behind 'origin/$EXPECTED_BRANCH'."
    echo "Please pull the latest changes from 'origin/$EXPECTED_BRANCH'."
    exit 1
fi

echo "Local '$EXPECTED_BRANCH' is synchronized with 'origin/$EXPECTED_BRANCH', and all changes are pushed."
echo ""

# 6. If all checks pass, tag and push
echo "All checks passed. Proceeding to tag and push."
echo "---------------------------------"
echo "Checking if tag $VERSION_TO_TAG already exists..."
if git rev-parse "$VERSION_TO_TAG" >/dev/null 2>&1; then
  echo "Error: Tag $VERSION_TO_TAG already exists locally."
  echo "If it also exists on the remote, you may need to delete it there first if this is a re-tagging attempt (not recommended)."
  exit 1
fi
# Check if tag exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$VERSION_TO_TAG$"; then
    echo "Error: Tag $VERSION_TO_TAG already exists on remote 'origin'."
    exit 1
fi
echo "Tag $VERSION_TO_TAG does not exist locally or on remote."
echo ""

echo "Creating tag $VERSION_TO_TAG..."
git tag "$VERSION_TO_TAG" -m "Release $VERSION_TO_TAG"
echo "Tag $VERSION_TO_TAG created locally."
echo ""

echo "Pushing tag $VERSION_TO_TAG to origin..."
git push origin "$VERSION_TO_TAG"
echo "Tag $VERSION_TO_TAG pushed to origin."
echo ""

echo "---------------------------------"
echo "Successfully tagged and pushed $VERSION_TO_TAG."
echo "Done."

exit 0
