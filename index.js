const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const cors = require("cors"); // Import cors

const app = express(); // Initialize app before using it

app.use(cors());

app.use(bodyParser.json());
const PORT = 8866;

const API_KEY = "CFA1B942C9A54AED89BB9A48DE152C5B";
const OPENAI_API_KEY =
  "sk-proj-ON7FKD58K2nJhK8hIdF3T3BlbkFJSjmx1VlJA67fDRPXnEjV";
const OPENAI_CONFIG = {
  model: "gpt-4o",
  max_tokens: 4096,
  temperature: 0.6,
  top_p: 1.0,
};

const YOUTUBE_API_KEY = "AIzaSyA6QfBndPd2ywM6bp-bxtUEEN2ruCOb4SY";
const YOUTUBE_API_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_API_VIDEO_URL = "https://www.googleapis.com/youtube/v3/videos";
let finalDetails = [];

async function handleSearch(req, res) {
  const { search_product } = req.body;
  try {
    // Replace with actual API endpoint and key
    const response = await axios.get(
      `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=amazon.com&search_term=${search_product}`,
      {
        headers: {
          Accept: "application/json",
          Connection: "keep-alive",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleProductInfo(req, res) {
  const { asin } = req.body;
  let productInformation = [];
  let reviews = [];
  try {
    const response = await axios.get(
      `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=product&amazon_domain=amazon.com&asin=${asin}&include_summarization_attributes=true&include_a_plus_body=true&output=json&include_html=false`,
      {
        headers: {
          Accept: "application/json",
          Connection: "keep-alive",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }
    );
    console.log(response);
    if (response.data?.product.description) {
      productInformation.push(
        await rewriteDescription(response.data.product.description)
      );
    }
    if (response.data?.product.top_reviews.length > 0) {
      reviews = await rewriteReviews(response);
    }
    res.send([...productInformation, ...reviews]);
  } catch (error) {
    res.status(500).json({ error: "Something went wrong -- please try again" });
  }
}

async function rewriteDescription(descriptions) {
  console.log("descriptions", descriptions);
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  let allDescriptions = [];

  console.log("allDescriptions", allDescriptions);

  try {
    for (const description of descriptions[0][0]) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: "user",
            content: `Rewrite the following product description in a simple manner without any business or technical jargon:\n\n${JSON.stringify(
              description
            )}. 
              Once completed, organize it into a short summary description with salient features in 
              numbered bullet points. Organize the output in a valid JSON format and return the JSON.
              Follow this JSON format: [{"summary":"put 2 line summary here"},{"put feature name here like quality or somthing "feature description here"} ]  Do not return any other text. remove all \\ or / Absolutely do not insert \`\`\`json or \`\`\` or \``,
          },
        ],
        stream: false,
        max_tokens: OPENAI_CONFIG.max_tokens,
        temperature: OPENAI_CONFIG.temperature,
        top_p: OPENAI_CONFIG.top_p,
      });

      // Parse the response to JSON and add to allDescriptions array
      const rewrittenDescription = JSON.parse(
        completion.choices[0].message.content.trim()
      );
      allDescriptions.push(rewrittenDescription);
    }

    console.log("allDescriptions", allDescriptions);
    return allDescriptions;
  } catch (error) {
    console.error("Error rewriting description:", error);
  }
}

async function rewriteReviews(response) {
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

  let allReviews = [];

  for (const review of response.product.top_reviews) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: "user",
            content: `Rewrite the following review text in a simple manner without any business or technical jargon:\n\n${review.body}. 
                Once completed, organize it into a short summary. Also, find the sentiment of the review. If it is positive, mark sentiment as "POSITIVE".
                If it is negative, mark sentiment as "NEGATIVE". Organize the output in a valid JSON format and return the JSON.
                Follow this JSON format: 
                {"review":"put review here","sentiment":"put sentiment here"}. Do not return any other text. Absolutely do not insert \`\`\`json or \`\`\` or \``,
          },
        ],
        stream: false,
        max_tokens: OPENAI_CONFIG.max_tokens,
        temperature: OPENAI_CONFIG.temperature,
        top_p: OPENAI_CONFIG.top_p,
      });

      // Parse the response to JSON and add to allReviews array
      const rewrittenReview = JSON.parse(
        completion.choices[0].message.content.trim()
      );
      allReviews.push(rewrittenReview);
    } catch (error) {
      console.error("Error rewriting review:", error);
    }
  }

  return allReviews;
}

// Function to read JSON file
const readJsonFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err); // Log the error
        return reject(err);
      }
      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseErr) {
        console.error("Error parsing JSON:", parseErr); // Log JSON parsing error
        reject(parseErr);
      }
    });
  });
};

async function getYoutubeShorts(req, res) {
  res
    .send(
      await searchYouTubeShorts(req.body.keyword, parseInt(req.body.maxresults))
    )
    .status(200);
}


async function searchYouTubeShorts(keyword, maxResults = 5) {
  try {
    const response = await axios.get(YOUTUBE_API_SEARCH_URL, {
      params: {
        part: 'snippet',
        q: keyword,
        type: 'video',
        videoDuration: 'short',
        maxResults: maxResults,
        key: YOUTUBE_API_KEY,
      },
    });

    if (response.data.items.length === 0) {
      throw new Error('No shorts found with the given keyword');
    }

    const videos = response.data.items.map((item) => ({
      video_id: item.id.videoId,
    }));

    const finalDetails = [];
    for (const video of videos) {
      finalDetails.push(await getVideoDetail(video.video_id));
    }

    return finalDetails; // Return the array of video details directly
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return { message: message };
  }
}


async function searchYouTubeVideos(keyword, maxResults = 5) {
  try {
    const response = await axios.get(YOUTUBE_API_SEARCH_URL, {
      params: {
        part: "snippet",
        q: keyword,
        type: "video",
        maxResults: maxResults,
        key: YOUTUBE_API_KEY,
      },
    });
    if (response.data.items.length === 0) {
      throw new Error("No shorts found with the given keyword");
    }
    const videos = response.data.items.map((item) => ({
      video_id: item.id.videoId,
    }));
    for (const video of videos) {
      finalDetails.push(await getVideoDetail(video.video_id));
    }
    return finalDetails
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return { message: message };
  }
}
async function getVideoDetail(videoId) {
  try {
    const response = await axios.get(YOUTUBE_API_VIDEO_URL, {
      params: {
        part: "snippet,contentDetails",
        id: videoId,
        key: YOUTUBE_API_KEY,
      },
    });

    if (response.data.items.length === 0) {
      throw new Error("No video found with the given ID");
    }

    const item = response.data.items[0];
    const title = item.snippet.title;
    const thumbnail = item.snippet.thumbnails.high.url;
    const description = item.snippet.description.replace(/https?:\/\/\S+/g, "");
    const duration = convertToSeconds(item.contentDetails.duration);
    return {
      video_id: item.id,
      title: title,
      duration: duration,
      thumbnail: thumbnail,
      description: description,
    };
  } catch (error) {
    console.error("Error fetching video detail:", error.message);
    return null;
  }
}
function convertToSeconds(duration) {
  const durationRegex =
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  const matches = duration.match(durationRegex);
  if (!matches) {
    throw new Error("Invalid string");
  }
  const [
    ,
    // full match
    years = 0,
    months = 0,
    weeks = 0,
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0,
  ] = matches.map((value) => parseInt(value, 10) || 0);
  return (
    years * 31536000 +
    months * 2592000 +
    weeks * 604800 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

// Get all products
app.get("/products", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "data.json");
    const products = await readJsonFile(filePath);

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error); // Log the error
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// API endpoint to get product by ASIN
app.get("/product/:asin", async (req, res) => {
  const { asin } = req.params;
  const filePath = path.join(__dirname, "data", "product.json");
  const products = await readJsonFile(filePath);

  res.json(products);
});

const readJsonFilee = async (filePath) => {
  const data = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(data);
};

const convertImageToBase64 = async (url) => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data, "binary");
    return buffer.toString("base64");
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
};

app.get("/productt/:asin", async (req, res) => {
  try {
    console.log("1");
    const { asin } = req.params;
    const filePath = path.join(__dirname, "data", "product.json");
    const products = await readJsonFilee(filePath);
    console.log("2");

    if (!products || !products.product) {
      return res.status(404).json({ error: "Product not found" });
    }
    console.log("3");

    const instagramFilePath = path.join(__dirname, "data", "instagram.json");
    const tiktokFilePath = path.join(__dirname, "data", "tiktok.json");
    const twitterFilePath = path.join(__dirname, "data", "twitter.json");
    console.log("4");

    const instagramData = await readJsonFile(instagramFilePath);
    const tiktokData = await readJsonFile(tiktokFilePath);
    const twitterData = await readJsonFile(twitterFilePath);
    console.log("5");

    // Convert Instagram images to base64
    for (const item of instagramData) {
      if (item.displayUrl) {
        item.base64Image = await convertImageToBase64(item.displayUrl);
      }
    }

    // Convert TikTok images to base64
    for (const item of tiktokData) {
      if (item.displayUrl) {
        item.base64Image = await convertImageToBase64(item.displayUrl);
      }
    }

    // Convert Twitter images to base64
    for (const item of twitterData) {
      if (item.twitterUrl) {
        item.base64Image = await convertImageToBase64(item.twitterUrl);
      }
    }

    console.log("6");
    // Uncomment and adapt the code below if you need to process descriptions and reviews
    let productInformation = [];
    let reviews = [];

    if (products.product.description) {
      const rewrittenDescription = await rewriteDescription(
        products.product.description
      );
      productInformation.push(rewrittenDescription[0]);
    }
    console.log("7");

    if (
      products.product.top_reviews &&
      products.product.top_reviews.length > 0
    ) {
      reviews = await rewriteReviews(products);
    }
    console.log("hello");
    console.log("1");

    console.log(products.product.title);
    // Search YouTube shorts related to the product
    const keyword = products.product.title; // Use product name as keyword
    const maxResults = 5; // Number of shorts to retrieve
    const youtubeShorts = await searchYouTubeShorts(keyword, maxResults);
    const youtubeVideos = await searchYouTubeVideos(keyword, maxResults);
    console.log("8");

    // Construct the response object
    const response = {
      products,
      productInformation,
      reviews,
      youtubeShorts,
      youtubeVideos,
      instagramData,
      tiktokData,
      twitterData,
    };
    console.log("9");

    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// app.post('/rewrite-description', rewriteDescription);
app.post("/get-youtube-shorts", getYoutubeShorts);

app.post("/search", handleSearch);
app.post("/product-info", handleProductInfo);
app.post("/rewrite-description", rewriteDescription);
app.get("/", (req, res) => {
  res.json({ message: "hello" });
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
