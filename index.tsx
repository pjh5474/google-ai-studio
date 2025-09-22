/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, GeneratedImage, PersonGeneration, Modality} from '@google/genai';

// --- DOM ELEMENTS ---
const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
const imageGallery = document.getElementById('image-gallery') as HTMLDivElement;
const imageEditingControls = document.getElementById('image-editing-controls') as HTMLDivElement;
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const generateEditBtn = document.getElementById('generate-edit-btn') as HTMLButtonElement;


if (!modelSelector || !imageGallery || !imageEditingControls || !imageUpload || !imagePreview || !promptInput || !generateEditBtn) {
    throw new Error("Required DOM elements not found.");
}

// --- GEMINI SETUP ---
console.log('apikey: ', process.env.API_KEY)
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- AVAILABLE MODELS ---
const availableModels = [
    'gemini-2.5-flash-image-preview',
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001',
    'imagen-3.0-generate-002',
];

// --- APP STATE ---
let uploadedImageData: { data: string, mimeType: string } | null = null;

// --- IMAGEN PROMPT ---
const imagenPrompt = 'Editorial wildlife photograph: a sleek black panther standing regally on a reflective salt flat at dusk, wearing a dramatic, sculptural couture gown inspired by organic forms. The landscape is vast and otherworldly but grounded in reality, with subtle shimmering textures and a warm, golden-hour glow. Captured with a cinematic 35mm lens, shallow depth of field, natural shadows, and authentic fur and fabric textures—evoking a high-fashion magazine cover with a surreal, yet believable, atmosphere.';

/**
 * Populates the model selector dropdown with available models.
 */
function populateModelSelector(): void {
    availableModels.forEach(modelName => {
        const option = document.createElement('option');
        option.value = modelName;
        option.textContent = modelName;
        modelSelector.appendChild(option);
    });
}

/**
 * Sets the loading state for the UI.
 * @param isLoading - Whether the application is in a loading state.
 */
function setLoading(isLoading: boolean): void {
    if (isLoading) {
        imageGallery.setAttribute('aria-busy', 'true');
        imageGallery.innerHTML = '<p class="loading">Generating images, please wait...</p>';
    } else {
        imageGallery.setAttribute('aria-busy', 'false');
        imageGallery.innerHTML = '';
    }
}

/**
 * Displays an error message in the UI.
 * @param message - The error message to display.
 */
function displayError(message: string): void {
    setLoading(false);
    imageGallery.innerHTML = `<p class="error">Error: ${message}</p>`;
}

/**
 * Handles image file selection and displays a preview.
 */
function handleImageUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            uploadedImageData = {
                data: base64String,
                mimeType: file.type,
            };
            imagePreview.src = `data:${file.type};base64,${base64String}`;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Generates an edited image using a prompt and an uploaded image.
 */
async function generateEditedImage(): Promise<void> {
    if (!uploadedImageData) {
        displayError('Please upload an image first.');
        return;
    }
    const prompt = promptInput.value.trim();
    if (!prompt) {
        displayError('Please enter a prompt to describe the edits.');
        return;
    }

    setLoading(true);

    try {
        const imagePart = {
            inlineData: {
                data: uploadedImageData.data,
                mimeType: uploadedImageData.mimeType,
            },
        };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [imagePart, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        setLoading(false);

        if (response?.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    const img = new Image();
                    img.src = src;
                    img.alt = prompt;
                    imageGallery.appendChild(img);
                } else if (part.text) {
                    console.log("Model's text response:", part.text);
                }
            }
        } else {
             displayError('No image was generated. The response may have been blocked.');
        }

        console.log('Full response:', response);

    } catch (error) {
        console.error("Error editing image:", error);
        displayError('Could not edit image. Check the console for details.');
    }
}

/**
 * Generates and displays images with Imagen models.
 */
async function generateImages(): Promise<void> {
    setLoading(true);
    const selectedModel = modelSelector.value;

    try {
        // NOTE: 'imagen-4.0-ultra-generate-001' only supports 1 image.
        const numberOfImages = selectedModel === 'imagen-4.0-ultra-generate-001' ? 1 : 3;

        const response = await ai.models.generateImages({
            model: selectedModel,
            prompt: imagenPrompt,
            config: {
                numberOfImages,
                aspectRatio: '1:1',
                personGeneration: PersonGeneration.ALLOW_ADULT,
                outputMimeType: 'image/jpeg',
                includeRaiReason: true,
            },
        });
        
        setLoading(false);

        if (response?.generatedImages) {
            response.generatedImages.forEach((generatedImage: GeneratedImage, index: number) => {
                if (generatedImage.image?.imageBytes) {
                    const src = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
                    const img = new Image();
                    img.src = src;
                    img.alt = `${imagenPrompt} - Image ${index + 1}`;
                    imageGallery.appendChild(img);
                }
            });
        }
        
        console.log('Full response:', response);

    } catch (error) {
        console.error("Error generating images:", error);
        displayError('Could not generate images. Check the console for details.');
    }
}

/**
 * Handles changes to the model selector dropdown to switch UI.
 */
function handleModelChange(): void {
    const selectedModel = modelSelector.value;
    setLoading(false);
    imageGallery.innerHTML = '';
    
    if (selectedModel === 'gemini-2.5-flash-image-preview') {
        imageEditingControls.style.display = 'flex';
        // Reset upload state
        uploadedImageData = null;
        imageUpload.value = '';
        imagePreview.src = '#';
        imagePreview.style.display = 'none';
        promptInput.value = '';

    } else {
        imageEditingControls.style.display = 'none';
        generateImages();
    }
}

// --- INITIALIZATION ---
populateModelSelector();
modelSelector.addEventListener('change', handleModelChange);
imageUpload.addEventListener('change', handleImageUpload);
generateEditBtn.addEventListener('click', generateEditedImage);
handleModelChange(); // Initial run on page load
