import { Ai } from '@cloudflare/ai'
import { Hono } from "hono"
import { prettyJSON } from 'hono/pretty-json'
import * as dotenv from "dotenv";
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';

dotenv.config();

export interface Env {
	AI: any;
	PINECONE_API_KEY: string;
	PINECONE_ENVIRONMENT: string;
	PINECONE_PROJECT_ID: string;
	PINECONE_INDEX: string;
}

const app = new Hono();

app.get('/', async (context) => {
	if (!context.env) {
		throw new Error('Environment variables not defined')
	}

	const ai = new Ai(context.env.AI)
	const answer = await ai.run(
		'@cf/meta/llama-2-7b-chat-int8',
		{
			messages: [
				{ role: 'user', content: `Cuál es la función de una enfermera jefe en Colombia?` }
			]
		}
	)

	return new Response(JSON.stringify(answer))
});

app.post('/question', async (context) => {
	if (!context.env) {
		throw new Error('Environment variables not defined')
	}

	const ai = new Ai(context.env.AI)
	const body = await context.req.parseBody()
	const question = body.Body as string
	console.debug("User asks: ", question)
	const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', {
		text: question,
	}
	);
	const values = embeddings.data[0]
	console.debug("Embeddings created for message")
	const headers = {
		'Api-Key': context.env.PINECONE_API_KEY as string,
		'Content-Type': 'application/json',
	};
	const url = `https://${context.env.PINECONE_INDEX}-${context.env.PINECONE_PROJECT_ID}.svc.${context.env.PINECONE_ENVIRONMENT}.pinecone.io/query`;
	const response = await fetch(url, { headers: headers, method: 'POST', body: JSON.stringify({ topK: 2, vector: values, includeMetadata: true }) });
	const data: MatchesResponse = await response.json();
	const texts = data['matches'].map((match) => match['metadata']['text']);
	console.debug("Responses from Pinecone", texts.join('\n'))

	const answer = await ai.run(
		'@cf/meta/llama-2-7b-chat-int8',
		{
			messages: [
				{ role: 'system', content: `Eres un asistente que debe responder a preguntas de enfermeria en Colombia. Usa el siguiente contexto para responder a la pregunta que te darán. Responde de manera concisa y de tal forma que tenga sentido según la pregunta recibida\n ${texts.join('\n')}` },
				{ role: 'user', content: question }
			]
		}
	)

	console.debug("Answer: ", answer.response)

	const messageResponse = new MessagingResponse();
	messageResponse.message(answer.response);

	return context.text(answer.response)
});

// app.get('/load', async (context) => {
// 	if (!context.env) {
// 		throw new Error('Environment variables not defined')
// 	}
// 	const query = context.req.query('url')
// 	const url_resolucion3280 = "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3280-de-2018.pdf"
// 	// check if query is not undefined or use url_resolucion3280
// 	const res = await fetch(query || url_resolucion3280);
// 	const blob = await res.blob();
// 	const loader = new WebPDFLoader(blob, {
// 		splitPages: false,
// 	  });
// 	const docs = await loader.load();
// 	const splitter = new RecursiveCharacterTextSplitter({
// 		chunkSize: 1000,
// 		chunkOverlap: 200,
// 	  });
// 	const docOutput = await splitter.splitDocuments(docs);
// 	const embeddings = new CloudflareWorkersAIEmbeddings({
// 		binding: context.env.AI  as Fetcher,
// 		modelName: "@cf/baai/bge-large-en-v1.5",
// 	  });
// 	const pinecone = new Pinecone();
// 	const index = pinecone.Index("documents-index");
// 	await PineconeStore.fromDocuments(docOutput, embeddings, {
// 		pineconeIndex: index,
// 	  });     
// 	return context.text('Document loaded!')
// });

app.use('*', prettyJSON())
app.notFound((c) => c.json({ message: 'Not Found', ok: false }, 404))

export default app


