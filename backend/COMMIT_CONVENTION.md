# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This helps maintain a clean and consistent git history.

## Format

Each commit message consists of a **header**, a **body**, and a **footer**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

The **header** is mandatory and must conform to the format:

- `type`: The type of change
- `scope`: The scope of the change (optional)
- `subject`: A short description of the change

## Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

## Examples

```
feat(auth): add login functionality
fix(api): handle null response from server
docs: update README with setup instructions
style: format code according to prettier rules
refactor(utils): simplify error handling logic
perf(db): optimize database queries
test(api): add tests for user endpoints
chore: update dependencies
```

## Rules

1. The type and subject are mandatory
2. The scope is optional
3. The subject should be in present tense and not capitalized
4. The subject should not end with a period
5. The body should explain what and why (not how)
6. The footer should contain any breaking changes or issue references

## Breaking Changes

If your commit includes breaking changes, add `BREAKING CHANGE:` in the footer:

```
feat(api): change response format

BREAKING CHANGE: API response format has changed from array to object
```

## References

If your commit relates to an issue, reference it in the footer:

```
fix(auth): handle expired tokens

Closes #123
```
