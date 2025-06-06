# NLP Package Configuration

## Required Environment Variables

The NLP package requires the following environment variables to be set:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# OpenAI Model (optional, defaults to gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini

# OpenAI Temperature (optional, defaults to 0.1)
OPENAI_TEMPERATURE=0.1

# Maximum Retries (optional, defaults to 3)
OPENAI_MAX_RETRIES=3

# Retry Delay in milliseconds (optional, defaults to 1000)
OPENAI_RETRY_DELAY=1000
```

## Environment Setup

1. **Development**: Create a `.env` file in the project root with the above variables
2. **Production**: Set these as environment variables in your deployment environment
3. **Testing**: Use dummy values for OPENAI_API_KEY when running tests

## Gateway Integration

The gateway package will automatically use these environment variables when the NLP client is instantiated.

## Security Notes

- Never commit your actual API key to version control
- Use different API keys for development, staging, and production
- Monitor your OpenAI usage and set appropriate rate limits 