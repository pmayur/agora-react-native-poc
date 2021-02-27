import axios from 'axios';
const GET_TOKEN_URL = 'https://api.dev.ours.community/agora/access_token'
// const GET_TOKEN_URL = 'http://192.168.0.105:8080/agora/access_token'

class GetTokenService {
    getAccessToken = async (channelName: string) => {
        const params = {
            channelName
        }
        try {
            const response = await axios.get(GET_TOKEN_URL, {params});
            console.log(response, 'response');
            return response.data.token
        } catch (error) {
            console.log(error, 'response');
            throw error;
        }

    }
}

export default new GetTokenService();