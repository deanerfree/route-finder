export const reqRigList = async(url:string) => {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const result = response.json()

    return result
  } catch (error:unknown) {
    console.error(error)
  }
}