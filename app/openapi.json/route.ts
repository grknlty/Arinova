import { subjects } from '@/lib/subjects';

// The public address the request came in on (Vercel sets these headers).
function origin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto =
    req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return host ? `${proto}://${host}` : url.origin;
}

const json = (ref: string) => ({
  'application/json': { schema: { $ref: `#/components/schemas/${ref}` } },
});

// OpenAPI description of the import endpoint, for a ChatGPT custom GPT
// action ("Import from URL"). It describes the API only; no data or keys.
// ChatGPT's editor requires the object schemas under components.schemas.
export function GET(req: Request) {
  return Response.json({
    openapi: '3.1.0',
    info: {
      title: 'Arinova',
      version: '1.0.0',
      description:
        'Adds practice tests with multiple-choice questions to Arinova, a family learning space.',
    },
    servers: [{ url: origin(req) }],
    paths: {
      '/api/sets': {
        post: {
          operationId: 'addStudySet',
          summary: 'Add one practice test (study set) with its questions.',
          security: [{ importKey: [] }],
          requestBody: { required: true, content: json('StudySet') },
          responses: {
            '201': { description: 'Saved.', content: json('Saved') },
            '400': {
              description: 'The test is invalid; the error names the problem.',
              content: json('Error'),
            },
            '403': {
              description: 'Missing or wrong import key; the error says which.',
              content: json('Error'),
            },
          },
        },
      },
    },
    components: {
      schemas: {
        StudySet: {
          type: 'object',
          required: ['title', 'subject', 'language', 'questions'],
          properties: {
            title: { type: 'string', maxLength: 150 },
            subject: {
              type: 'string',
              description: `School subject: ${subjects.map((s) => s.name).join(', ')}.`,
            },
            language: { type: 'string', enum: ['nl', 'tr', 'en'] },
            description: { type: 'string', maxLength: 1000 },
            material: {
              type: 'string',
              maxLength: 50000,
              description:
                'Optional study text shown under "Learn first" (plain text; line breaks are kept).',
            },
            questions: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: { $ref: '#/components/schemas/Question' },
            },
          },
        },
        Question: {
          type: 'object',
          required: ['prompt', 'options', 'correctIndex'],
          properties: {
            prompt: { type: 'string', description: 'The question.' },
            options: {
              type: 'array',
              minItems: 2,
              maxItems: 6,
              items: { type: 'string' },
              description: 'Answer options, shown as A, B, C…',
            },
            correctIndex: {
              type: 'integer',
              minimum: 0,
              description:
                'Zero-based index of the one correct option (0 = A, 1 = B, …).',
            },
            explanation: {
              type: 'string',
              description: 'Why the correct answer is right.',
            },
            image: {
              type: 'string',
              description:
                'Optional picture as a data URL: data:image/png;base64,… (PNG, JPEG, WebP or GIF).',
            },
          },
        },
        Saved: { type: 'object', properties: { id: { type: 'string' } } },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
      securitySchemes: { importKey: { type: 'http', scheme: 'bearer' } },
    },
  });
}
