import { Ai } from '@cloudflare/ai'

export interface Env {
	AI: any;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const ai = new Ai(env.AI)
		const answer = await ai.run(
			'@cf/meta/llama-2-7b-chat-int8',
			{
			  messages: [
				{ role: 'user', content: `Cuál es la función de una enfermera jefe en Colombia?` }
			  ]
			}
		  )
	  
		return new Response(JSON.stringify(answer))
	},
};
