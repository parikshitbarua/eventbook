import { create } from '@web3-storage/w3up-client';
export const uploadImagesToIPFSHelperUtil = async (files: File[]) => {
  try {
    if (files.length < 1) return undefined;
    const client = await create();
    await client.setCurrentSpace(import.meta.env.VITE_WEB3STORAGE_SPACE);
    const imageDirectoryCID = await client.uploadDirectory(files);
    console.log('Image directory CID:', imageDirectoryCID.toString());
    return imageDirectoryCID.toString(); // Convert CID object to string
  } catch (error) {
    console.log('Error uploading files', error);
    return undefined;
  }
};

export const createEventURIHelper = async (
  title: string,
  description: string,
  country: string,
  city: string,
  state: string,
  venue: string,
  imageDirectoryCID: string,
) => {
  try {
    const client = await create();
    await client.setCurrentSpace(import.meta.env.VITE_WEB3STORAGE_SPACE);

    // Create metadata object
    const metadata = {
      name: title,
      description,
      country,
      city,
      state,
      venue,
      image: imageDirectoryCID
        ? `https://${imageDirectoryCID}.ipfs.w3s.link`
        : '',
    };

    // Create a single JSON file
    const jsonFile = makeJsonFile('event-metadata', metadata);

    // Upload the file to web3.storage
    const eventURICID = await client.uploadFile(jsonFile);

    console.log('Event metadata CID:', eventURICID);

    // Return the IPFS URL
    return `https://${eventURICID.toString()}.ipfs.w3s.link`;
  } catch (error) {
    console.error('Error creating event URI:', error);
    throw error;
  }
};

function makeJsonFile(filename: string, data): File {
  // Create a JSON blob from the data
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  // Return a single File object
  return new File([blob], `${filename}.json`, { type: 'application/json' });
}

// Helper function to fetch the first image from an IPFS directory
export const fetchFirstImageFromIPFS = async (
  ipfsDirectoryUrl: string,
): Promise<string | null> => {
  try {
    // Fetch the directory listing from IPFS
    const response = await fetch(ipfsDirectoryUrl);
    if (!response.ok) {
      console.error('Failed to fetch IPFS directory:', response.statusText);
      return null;
    }

    // The response might be HTML (gateway) or JSON depending on how it's accessed
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      // If it's JSON, parse it directly
      const data = await response.json();
      if (data.length > 0) {
        return `${ipfsDirectoryUrl}/${data[0].name}`;
      }
    } else {
      // If it's HTML (gateway response), we need to parse the directory listing
      const html = await response.text();

      // Look for image files in the HTML
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      const linkRegex = /<a href="([^"]+)"/g;
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1];
        const extension = url.split('.').pop()?.toLowerCase();

        if (extension && imageExtensions.includes(extension)) {
          // If fileName already contains the full URL, return it directly
          if (url.startsWith('http')) {
            return decodeURIComponent(url);
          }
          const fileName = url.split('/').pop();
          // Otherwise, construct the full URL
          return `${ipfsDirectoryUrl}/${decodeURIComponent(fileName)}`;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching first image from IPFS:', error);
    return null;
  }
};
